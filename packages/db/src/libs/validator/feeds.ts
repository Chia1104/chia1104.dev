import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from "drizzle-zod";
import * as z from "zod";

import { contents, feedMeta } from "../../schema";
import { ContentType, FeedOrderBy, FeedType } from "../../types";
import { internal_feedsOmitEmbedding } from "../internal_schema";
import {
  dateSchema,
  baseInfiniteSchema as baseInfiniteSchemaShared,
} from "./shared";

export const baseInfiniteSchema = z.object({
  ...baseInfiniteSchemaShared.shape,
  orderBy: z.enum(FeedOrderBy).optional().default(FeedOrderBy.UpdatedAt),
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
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
});

export const insertFeedSchema = z.object({
  ...createInsertSchema(internal_feedsOmitEmbedding).omit({
    createdAt: true,
    updatedAt: true,
  }).shape,
  ...internal_dateSchema.shape,
  embedding: z.array(z.number()).nullable().optional(),
});

export const updateFeedSchema = z.object({
  ...createUpdateSchema(internal_feedsOmitEmbedding).omit({
    createdAt: true,
    updatedAt: true,
  }).shape,
  ...internal_dateSchema.shape,
  embedding: z.array(z.number()).nullable().optional(),
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

export const feedSchema = z.object({
  ...createSelectSchema(internal_feedsOmitEmbedding).shape,
  ...internal_dateSchema.shape,
  embedding: z.array(z.number()).nullable(),
});
export type FeedDTO = z.infer<typeof feedSchema>;

export const contentSchema = createSelectSchema(contents);
export type ContentDTO = z.infer<typeof contentSchema>;

export const feedMetaSchema = createSelectSchema(feedMeta);
export type FeedMetaDTO = z.infer<typeof feedMetaSchema>;
