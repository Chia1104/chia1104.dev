export const FeedType = {
  Post: "post",
  Note: "note",
  /** How to get through something, usually a game. */
  Guide: "guide",
  /** What the owner made of a work. */
  Review: "review",
  /** Life outside of work and of any one title. */
  Journal: "journal",
  /** A filter value, never stored: no narrowing by type. */
  All: "all",
} as const;

export type FeedType = (typeof FeedType)[keyof typeof FeedType];

/** The face of the site a feed is written for. www gives each its own URL space, and neither lists the other's. */
export const FeedMode = {
  Tech: "tech",
  Hobby: "hobby",
} as const;

export type FeedMode = (typeof FeedMode)[keyof typeof FeedMode];

/** A feed's type decides its mode, so a feed cannot be stored in the wrong one. */
export const FEED_MODE_TYPES = {
  [FeedMode.Tech]: [FeedType.Post, FeedType.Note],
  [FeedMode.Hobby]: [FeedType.Guide, FeedType.Review, FeedType.Journal],
} as const satisfies Record<
  FeedMode,
  readonly Exclude<FeedType, typeof FeedType.All>[]
>;

export type FeedTypeOf<TMode extends FeedMode> =
  (typeof FEED_MODE_TYPES)[TMode][number];

/** Narrows a feed's type to the ones `mode` carries. */
export const isFeedTypeOf = <TMode extends FeedMode>(
  mode: TMode,
  type: string
): type is FeedTypeOf<TMode> =>
  FEED_MODE_TYPES[mode].some((candidate) => candidate === type);

export const feedModeOf = (
  type: Exclude<FeedType, typeof FeedType.All>
): FeedMode =>
  type === FeedType.Post || type === FeedType.Note
    ? FeedMode.Tech
    : FeedMode.Hobby;

export const FeedOrderBy = {
  UpdatedAt: "updatedAt",
  CreatedAt: "createdAt",
  Id: "id",
  Slug: "slug",
} as const;

export type FeedOrderBy = (typeof FeedOrderBy)[keyof typeof FeedOrderBy];

export const Locale = {
  En: "en",
  ZhTW: "zh-TW",
} as const;

export type Locale = (typeof Locale)[keyof typeof Locale];

export const ProfileEntryKind = {
  /** The one self-introduction; the site and the agent read the first published row. */
  About: "about",
  Experience: "experience",
  Education: "education",
  Project: "project",
} as const;

export type ProfileEntryKind =
  (typeof ProfileEntryKind)[keyof typeof ProfileEntryKind];

export const MediaKind = {
  Movie: "movie",
  Series: "series",
  Anime: "anime",
  Game: "game",
} as const;

export type MediaKind = (typeof MediaKind)[keyof typeof MediaKind];

export const MediaStatus = {
  Planned: "planned",
  InProgress: "in-progress",
  Completed: "completed",
  Dropped: "dropped",
} as const;

export type MediaStatus = (typeof MediaStatus)[keyof typeof MediaStatus];

/** The catalogue a work was added from; with `sourceId` it names the work there. */
export const MediaSource = {
  TmdbMovie: "tmdb:movie",
  TmdbTv: "tmdb:tv",
  Anilist: "anilist",
  Igdb: "igdb",
} as const;

export type MediaSource = (typeof MediaSource)[keyof typeof MediaSource];
