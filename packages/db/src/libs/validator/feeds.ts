import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from "drizzle-orm/zod";
import * as z from "zod";

import { feeds, feedTranslations, locale } from "../../schemas/schema.ts";
import { FeedOrderBy, FeedType } from "../../types";

import {
  dateSchema,
  baseInfiniteSchema as baseInfiniteSchemaShared,
} from "./shared";

export const baseInfiniteSchema = baseInfiniteSchemaShared.extend({
  orderBy: z.enum(FeedOrderBy).optional().default(FeedOrderBy.UpdatedAt),
  type: z.enum(FeedType).optional(),
  withContent: z.boolean().optional().default(false),
  locale: z.enum(locale.enumValues).optional(),
});

export const infiniteSchema = baseInfiniteSchema.optional().default({
  limit: 10,
  cursor: null,
  orderBy: FeedOrderBy.UpdatedAt,
  sortOrder: "desc",
  withContent: false,
});

export type InfiniteDTO = z.infer<typeof infiniteSchema>;

const internalDateFields = {
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
};

export const insertFeedSchema = createInsertSchema(feeds)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend(internalDateFields);

export const updateFeedSchema = createUpdateSchema(feeds)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend(internalDateFields);

export type InsertFeedDTO = z.infer<typeof insertFeedSchema>;
export type UpdateFeedDTO = z.infer<typeof updateFeedSchema>;

/** `published`/`deleted` mirror `feed`; written by the indexing workflow, not callers. */
const internalTranslationColumns = {
  id: true,
  feedId: true,
  createdAt: true,
  updatedAt: true,
  published: true,
  deleted: true,
} as const;

export const insertFeedTranslationSchema = createInsertSchema(
  feedTranslations
).omit(internalTranslationColumns);

export const updateFeedTranslationSchema = createUpdateSchema(
  feedTranslations
).omit(internalTranslationColumns);

export type InsertFeedTranslationDTO = z.infer<
  typeof insertFeedTranslationSchema
>;
export type UpdateFeedTranslationDTO = z.infer<
  typeof updateFeedTranslationSchema
>;

export const feedSchema = createSelectSchema(feeds).extend(internalDateFields);

export const feedTranslationSchema =
  createSelectSchema(feedTranslations).extend(internalDateFields);

export type FeedDTO = z.infer<typeof feedSchema>;
export type FeedTranslationDTO = z.infer<typeof feedTranslationSchema>;
