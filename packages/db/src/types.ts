export const Role = {
  Root: "root",
  Admin: "admin",
  User: "user",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const FeedType = {
  Post: "post",
  Note: "note",
  All: "all",
} as const;

export type FeedType = (typeof FeedType)[keyof typeof FeedType];

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
