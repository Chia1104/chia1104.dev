import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { feeds, posts, notes } from "../../schema";
import { ArticleType, FeedOrderBy, FeedType } from "../../types";

export const baseInfiniteSchema = z.object({
  limit: z.number().max(50).optional().default(10),
  cursor: z.union([z.string(), z.number()]).nullish(),
  orderBy: z.nativeEnum(FeedOrderBy).optional().default(FeedOrderBy.UpdatedAt),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  type: z.nativeEnum(FeedType).optional().default(FeedType.Post),
});

export const infiniteSchema = baseInfiniteSchema.optional().default({
  limit: 10,
  cursor: null,
  orderBy: FeedOrderBy.UpdatedAt,
  sortOrder: "desc",
  type: FeedType.Post,
});

export type InfiniteDTO = z.infer<typeof infiniteSchema>;

export const getPublicFeedBySlugSchema = z.object({
  type: z.nativeEnum(FeedType).optional().default(FeedType.Post),
  slug: z.string().min(1),
});

export const getFeedByIdSchema = z.object({
  type: z.nativeEnum(FeedType).optional().default(FeedType.Post),
  feedId: z.number(),
});

export type GetPublicFeedBySlugDTO = z.infer<typeof getPublicFeedBySlugSchema>;

export const insertFeedSchema = createInsertSchema(feeds);

export type InsertFeedDTO = z.infer<typeof insertFeedSchema>;

export const insertFeedContentSchema = (type: "post" | "note") =>
  type === "post"
    ? createInsertSchema(posts)
        .omit({ type: true })
        .merge(
          z.object({
            contentType: z
              .nativeEnum(ArticleType)
              .nullish()
              .default(ArticleType.Mdx),
          })
        )
    : createInsertSchema(notes)
        .omit({ type: true })
        .merge(
          z.object({
            contentType: z
              .nativeEnum(ArticleType)
              .nullish()
              .default(ArticleType.Mdx),
          })
        );

export type InsertFeedContentDTO = z.infer<
  ReturnType<typeof insertFeedContentSchema>
>;
