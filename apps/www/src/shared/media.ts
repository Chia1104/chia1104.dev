import { Locale as DBLocale, MediaKind, MediaSource } from "@chia/db/types";

import type { RouterOutputs } from "@/libs/orpc/types";

export type MediaEntry = RouterOutputs["media"]["list"]["items"][number];
/** A work with what only its own page shows. */
export type MediaWork = RouterOutputs["media"]["get"];
export type MediaAchievement = MediaWork["achievements"][number];

/** The path segment under `/hobby` that lists each kind. */
export const MEDIA_KIND_SEGMENT = {
  [MediaKind.Movie]: "movies",
  [MediaKind.Series]: "series",
  [MediaKind.Anime]: "anime",
  [MediaKind.Game]: "games",
} as const satisfies Record<MediaKind, string>;

export const mediaKindOfSegment = (segment: string): MediaKind | undefined =>
  Object.values(MediaKind).find((kind) => MEDIA_KIND_SEGMENT[kind] === segment);

/** A work's own page; opened from the list it shows as a sheet over it. */
export const mediaHrefOf = (entry: Pick<MediaEntry, "kind" | "slug">) =>
  `/hobby/${MEDIA_KIND_SEGMENT[entry.kind]}/${entry.slug}` as const;

export const MEDIA_SOURCE_NAME = {
  [MediaSource.TmdbMovie]: "TMDB",
  [MediaSource.TmdbTv]: "TMDB",
  [MediaSource.Anilist]: "AniList",
  [MediaSource.Igdb]: "IGDB",
} as const satisfies Record<MediaSource, string>;

/** The reader's locale first, then any other the entry carries. */
export const mediaTitleOf = (entry: MediaEntry, locale: DBLocale) =>
  (
    entry.translations[locale] ??
    Object.values(DBLocale)
      .map((other) => entry.translations[other])
      .find((translation) => translation !== undefined)
  )?.title ??
  entry.originalTitle ??
  "";

/** The colour the hobby pages wear while no work is in focus; `@chia/themes/hobby.css` starts from the same value. */
export const HOBBY_IDLE_COLOR = "#45b0c5";

/** One line of the hobby list: what a row shows, and what the stage needs once it is in focus. */
export interface MediaRow {
  id: number;
  title: string;
  /** Already in the reader's language. */
  kind: string;
  year: number | null;
  /** The work's own page. */
  href: ReturnType<typeof mediaHrefOf>;
  color: string | null;
  backdropUrl: string | null;
}

/** How scarce an achievement is among the game's players. */
export const AchievementRarity = {
  Rare: "rare",
  Uncommon: "uncommon",
  Common: "common",
} as const;

export type AchievementRarity =
  (typeof AchievementRarity)[keyof typeof AchievementRarity];

/** Steam's own client frames an achievement as rare below this share of players. */
const RARE_BELOW_PERCENT = 10;
const COMMON_FROM_PERCENT = 50;

/** An achievement Steam reports no share for is treated as common: nothing marks it. */
export const achievementRarityOf = (
  globalPercent: number | null
): AchievementRarity => {
  if (globalPercent === null || globalPercent >= COMMON_FROM_PERCENT) {
    return AchievementRarity.Common;
  }
  return globalPercent < RARE_BELOW_PERCENT
    ? AchievementRarity.Rare
    : AchievementRarity.Uncommon;
};

/**
 * What a work's page lists: the unlocked ones rarest first, then the locked ones nearest first.
 * A hidden achievement still locked is only counted, since its name alone can spoil the game.
 */
export const arrangeAchievements = (achievements: MediaAchievement[]) => {
  const share = (item: MediaAchievement) => item.globalPercent ?? 100;
  const shown = achievements.filter((item) => item.unlocked || !item.hidden);
  return {
    listed: [
      ...shown
        .filter((item) => item.unlocked)
        .sort((a, b) => share(a) - share(b)),
      ...shown
        .filter((item) => !item.unlocked)
        .sort((a, b) => share(b) - share(a)),
    ],
    hiddenLocked: achievements.length - shown.length,
  };
};
