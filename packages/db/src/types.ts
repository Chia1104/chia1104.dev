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

export const ArticleType = {
  Mdx: "mdx",
  Md: "md",
  Notion: "notion",
  Sanity: "sanity",
  Tiptap: "tiptap",
} as const;

export type ArticleType = (typeof ArticleType)[keyof typeof ArticleType];

export const FeedOrderBy = {
  UpdatedAt: "updatedAt",
  CreatedAt: "createdAt",
  Id: "id",
  Slug: "slug",
  Title: "title",
} as const;

export type FeedOrderBy = (typeof FeedOrderBy)[keyof typeof FeedOrderBy];
