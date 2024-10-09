import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { contents } from "../../schema";
import { ContentType, FeedOrderBy, FeedType } from "../../types";
import { internal_feedsOmitEmbedding } from "../internal_schema";

export const baseInfiniteSchema = z.object({
  limit: z.number().max(50).optional().default(10),
  cursor: z.union([z.string(), z.number()]).nullish(),
  orderBy: z.nativeEnum(FeedOrderBy).optional().default(FeedOrderBy.UpdatedAt),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  type: z.nativeEnum(FeedType).optional(),
  withContent: z.boolean().optional().default(false),
});

export const infiniteSchema = baseInfiniteSchema.optional().default({
  limit: 10,
  cursor: null,
  orderBy: FeedOrderBy.UpdatedAt,
  sortOrder: "desc",
});

export type InfiniteDTO = z.infer<typeof infiniteSchema>;

const internal_dateSchema = z.object({
  createdAt: z.union([z.string(), z.number()]).optional(),
  updatedAt: z.union([z.string(), z.number()]).optional(),
});

export const insertFeedSchema = createInsertSchema(internal_feedsOmitEmbedding)
  .omit({
    createdAt: true,
    updatedAt: true,
  })
  .merge(internal_dateSchema);

export type InsertFeedDTO = z.infer<typeof insertFeedSchema>;

export const insertFeedContentSchema = createInsertSchema(contents).merge(
  z.object({
    contentType: z.nativeEnum(ContentType).optional().default(ContentType.Mdx),
  })
);

export type InsertFeedContentDTO = z.infer<typeof insertFeedContentSchema>;
