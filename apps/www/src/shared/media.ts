import { Locale as DBLocale, MediaKind, MediaSource } from "@chia/db/types";

import type { RouterOutputs } from "@/libs/orpc/types";

export type MediaEntry = RouterOutputs["media"]["list"]["items"][number];

/** The path segment under `/hobby` that lists each kind. */
export const MEDIA_KIND_SEGMENT = {
  [MediaKind.Movie]: "movies",
  [MediaKind.Series]: "series",
  [MediaKind.Anime]: "anime",
  [MediaKind.Game]: "games",
} as const satisfies Record<MediaKind, string>;

export const mediaKindOfSegment = (segment: string): MediaKind | undefined =>
  Object.values(MediaKind).find((kind) => MEDIA_KIND_SEGMENT[kind] === segment);

export const MEDIA_SOURCE_NAME = {
  [MediaSource.TmdbMovie]: "TMDB",
  [MediaSource.TmdbTv]: "TMDB",
  [MediaSource.Anilist]: "AniList",
  [MediaSource.Igdb]: "IGDB",
} as const satisfies Record<MediaSource, string>;

/** The reader's locale first, then any other the entry carries. */
export const mediaTranslationOf = (entry: MediaEntry, locale: DBLocale) =>
  entry.translations[locale] ??
  Object.values(DBLocale)
    .map((other) => entry.translations[other])
    .find((translation) => translation !== undefined);

export const mediaTitleOf = (entry: MediaEntry, locale: DBLocale) =>
  mediaTranslationOf(entry, locale)?.title ?? entry.originalTitle ?? "";
