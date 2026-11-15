import { Locale, MediaKind, MediaSource } from "@chia/db/types";
import {
  MEDIA_TITLE_MAX_CHARS,
  mediaColorSchema,
} from "@chia/db/validator/media";
import type { MediaTranslations } from "@chia/db/validator/media";
import { logger } from "@chia/observability/logger";

import type { MediaCandidate } from "./media.contract";

/**
 * The catalogues searched for each kind, in the order their results are listed. Anime has two:
 * AniList lists each season as its own work, TMDB carries the Traditional Chinese titles.
 */
export const MEDIA_KIND_SOURCES = {
  [MediaKind.Movie]: [MediaSource.TmdbMovie],
  [MediaKind.Series]: [MediaSource.TmdbTv],
  [MediaKind.Anime]: [MediaSource.Anilist, MediaSource.TmdbTv],
  [MediaKind.Game]: [MediaSource.Igdb],
} as const satisfies Record<MediaKind, readonly MediaSource[]>;

/** A work's facts as stored on a row; the image URLs are still the catalogue's. */
export interface MediaSnapshot {
  translations: MediaTranslations;
  originalTitle: string | null;
  releaseYear: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  /** The catalogue's own colour for the cover, when it publishes one. */
  color: string | null;
  /** A game's id on Steam, when the catalogue links its store page. */
  steamAppId: number | null;
  sourceUrl: string;
}

/**
 * A catalogue's titles as the stored translations, or `null` when it has none worth storing.
 * Stored rows are parsed on every public read, so a blank or oversized title must not get in.
 */
const translationsOf = (
  titles: Partial<Record<Locale, string | null>>
): MediaTranslations | null => {
  const translations: MediaTranslations = {};
  for (const locale of Object.values(Locale)) {
    const title = titles[locale]?.trim().slice(0, MEDIA_TITLE_MAX_CHARS);
    if (title) translations[locale] = { title };
  }
  return Object.keys(translations).length > 0 ? translations : null;
};

/**
 * Catalogue clients load on first use: the router imports every route module at boot, and a
 * static import would parse each catalogue's env in processes that never search one.
 */
const loadTmdb = () => import("@chia/integrations/tmdb");
const loadAnilist = () => import("@chia/integrations/anilist");
const loadIgdb = () => import("@chia/integrations/igdb");

const tmdbTypeOf = async (
  source: typeof MediaSource.TmdbMovie | typeof MediaSource.TmdbTv
) => {
  const { TmdbMediaType } = await loadTmdb();
  return source === MediaSource.TmdbMovie
    ? TmdbMediaType.Movie
    : TmdbMediaType.Tv;
};

const searchSource = async (
  source: MediaSource,
  query: string,
  signal?: AbortSignal
): Promise<MediaCandidate[]> => {
  switch (source) {
    case MediaSource.TmdbMovie:
    case MediaSource.TmdbTv: {
      const { TmdbLanguage, searchTmdb } = await loadTmdb();
      const works = await searchTmdb(
        await tmdbTypeOf(source),
        query,
        TmdbLanguage.ZhTW,
        signal
      );
      return works.map((work) => ({
        source,
        sourceId: String(work.id),
        title: work.title,
        originalTitle: work.originalTitle,
        releaseYear: work.releaseYear,
        posterUrl: work.posterUrl,
        url: work.url,
      }));
    }
    case MediaSource.Anilist: {
      const { searchAnilistAnime } = await loadAnilist();
      const anime = await searchAnilistAnime(query, signal);
      return anime.map((item) => ({
        source,
        sourceId: String(item.id),
        title:
          item.titles.english ?? item.titles.romaji ?? item.titles.native ?? "",
        originalTitle: item.titles.native,
        releaseYear: item.releaseYear,
        posterUrl: item.coverUrl,
        url: item.url,
      }));
    }
    case MediaSource.Igdb: {
      const { searchIgdbGames } = await loadIgdb();
      const games = await searchIgdbGames(query, signal);
      return games.map((game) => ({
        source,
        sourceId: String(game.id),
        title: game.name,
        originalTitle: null,
        releaseYear: game.releaseYear,
        posterUrl: game.coverUrl,
        url: game.url,
      }));
    }
  }
};

/**
 * Searches every catalogue of `kind`. One catalogue failing leaves the others' results; the
 * search fails only when none answered.
 */
export const searchMediaCatalogues = async (
  kind: MediaKind,
  query: string,
  signal?: AbortSignal
): Promise<MediaCandidate[]> => {
  const sources = MEDIA_KIND_SOURCES[kind];
  const settled = await Promise.allSettled(
    sources.map((source) => searchSource(source, query, signal))
  );
  const items: MediaCandidate[] = [];
  const failures: Error[] = [];
  for (const [index, result] of settled.entries()) {
    if (result.status === "fulfilled") {
      items.push(...result.value);
      continue;
    }
    const error =
      result.reason instanceof Error
        ? result.reason
        : new Error(String(result.reason));
    failures.push(error);
    logger.warn(
      { err: error, source: sources[index] },
      "Media catalogue search failed"
    );
  }
  if (failures.length === sources.length) {
    throw new AggregateError(failures, "Every media catalogue failed");
  }
  return items;
};

/** A positive integer id, or `null` for anything a catalogue could not have issued. */
const catalogueIdOf = (sourceId: string) =>
  /^[1-9]\d*$/.test(sourceId) ? Number(sourceId) : null;

/** Reads the work from its catalogue. `null` when the catalogue has no such work. */
export const resolveMediaSnapshot = async (
  source: MediaSource,
  sourceId: string,
  signal?: AbortSignal
): Promise<MediaSnapshot | null> => {
  const id = catalogueIdOf(sourceId);
  if (id === null) return null;

  switch (source) {
    case MediaSource.TmdbMovie:
    case MediaSource.TmdbTv: {
      const { TmdbLanguage, getTmdbWork } = await loadTmdb();
      const type = await tmdbTypeOf(source);
      const [zh, en] = await Promise.all([
        getTmdbWork(type, id, TmdbLanguage.ZhTW, signal),
        getTmdbWork(type, id, TmdbLanguage.EnUS, signal),
      ]);
      if (!zh || !en) return null;
      const translations = translationsOf({
        [Locale.ZhTW]: zh.title,
        [Locale.En]: en.title,
      });
      if (!translations) return null;
      return {
        translations,
        originalTitle: zh.originalTitle,
        releaseYear: zh.releaseYear,
        posterUrl: zh.posterUrl ?? en.posterUrl,
        backdropUrl: zh.backdropUrl ?? en.backdropUrl,
        color: null,
        steamAppId: null,
        sourceUrl: zh.url,
      };
    }
    case MediaSource.Anilist: {
      const { getAnilistAnime } = await loadAnilist();
      const anime = await getAnilistAnime(id, signal);
      if (!anime) return null;
      const translations = translationsOf({
        [Locale.En]:
          anime.titles.english ?? anime.titles.romaji ?? anime.titles.native,
      });
      if (!translations) return null;
      return {
        translations,
        originalTitle: anime.titles.native,
        releaseYear: anime.releaseYear,
        posterUrl: anime.coverUrl,
        backdropUrl: anime.bannerUrl,
        // AniList documents a hex colour; anything else is dropped and the cover's is used.
        color: mediaColorSchema.safeParse(anime.color).data ?? null,
        steamAppId: null,
        sourceUrl: anime.url,
      };
    }
    case MediaSource.Igdb: {
      const { getIgdbGame } = await loadIgdb();
      const game = await getIgdbGame(id, signal);
      if (!game) return null;
      const translations = translationsOf({ [Locale.En]: game.name });
      if (!translations) return null;
      return {
        translations,
        originalTitle: null,
        releaseYear: game.releaseYear,
        posterUrl: game.coverUrl,
        backdropUrl: game.artworkUrl,
        color: null,
        steamAppId: game.steamAppId,
        sourceUrl: game.url,
      };
    }
  }
};
