import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";

import { contents, feedMeta } from "../../schema";
import { ContentType, FeedOrderBy, FeedType } from "../../types";
import { internal_feedsOmitEmbedding } from "../internal_schema";

export const baseInfiniteSchema = z.object({
  limit: z.number().max(50).optional().default(10),
  cursor: z.union([z.string(), z.number()]).nullish(),
  orderBy: z.enum(FeedOrderBy).optional().default(FeedOrderBy.UpdatedAt),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  type: z.enum(FeedType).optional(),
  withContent: z.boolean().optional().default(false),
});

export const infiniteSchema = baseInfiniteSchema.optional().default({
  limit: 10,
  cursor: null,
  orderBy: FeedOrderBy.UpdatedAt,
  sortOrder: "desc",
  withContent: false,
});

export type InfiniteDTO = z.infer<typeof infiniteSchema>;

const internal_dateSchema = z.object({
  createdAt: z.union([z.string(), z.number()]).optional(),
  updatedAt: z.union([z.string(), z.number()]).optional(),
});

const internal_embeddingSchema = z.object({
  embedding: z.array(z.number()).optional(),
});

export const insertFeedSchema = z.object({
  ...createInsertSchema(internal_feedsOmitEmbedding).omit({
    createdAt: true,
    updatedAt: true,
  }).shape,
  ...internal_dateSchema.shape,
  ...internal_embeddingSchema.shape,
});

export const updateFeedSchema = z.object({
  ...createUpdateSchema(internal_feedsOmitEmbedding).omit({
    createdAt: true,
    updatedAt: true,
  }).shape,
  ...internal_dateSchema.shape,
  ...internal_embeddingSchema.shape,
});

export type InsertFeedDTO = z.infer<typeof insertFeedSchema>;
export type UpdateFeedDTO = z.infer<typeof updateFeedSchema>;

export const insertFeedContentSchema = z.object({
  ...createInsertSchema(contents).shape,
  contentType: z.enum(ContentType).optional().default(ContentType.Mdx),
});

export const updateFeedContentSchema = z.object({
  ...createUpdateSchema(contents).shape,
  contentType: z.enum(ContentType).optional().default(ContentType.Mdx),
});

export type InsertFeedContentDTO = z.infer<typeof insertFeedContentSchema>;
export type UpdateFeedContentDTO = z.infer<typeof updateFeedContentSchema>;

export const insertFeedMetaSchema = createInsertSchema(feedMeta);

export type InsertFeedMetaDTO = z.infer<typeof insertFeedMetaSchema>;
