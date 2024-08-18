export const Role = {
  Admin: "admin",
  User: "user",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const FeedType = {
  Post: "post",
  Note: "note",
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
  Title: "title",
} as const;

export type FeedOrderBy = (typeof FeedOrderBy)[keyof typeof FeedOrderBy];
