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

export const ContentType = {
  Mdx: "mdx",
  Notion: "notion",
  Tiptap: "tiptap",
  Plate: "plate",
} as const;

export type ContentType = (typeof ContentType)[keyof typeof ContentType];

export const FeedOrderBy = {
  UpdatedAt: "updatedAt",
  CreatedAt: "createdAt",
  Id: "id",
  Slug: "slug",
} as const;

export type FeedOrderBy = (typeof FeedOrderBy)[keyof typeof FeedOrderBy];

export const Locale = {
  En: "en",
  zhTW: "zh-TW",
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
