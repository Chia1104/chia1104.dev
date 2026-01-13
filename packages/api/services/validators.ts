import * as z from "zod";

import { locale } from "@chia/db";
import { FeedOrderBy } from "@chia/db/types";
import {
  baseInfiniteSchema,
  insertFeedTranslationSchema,
  updateFeedSchema,
} from "@chia/db/validator/feeds";
import { NumericStringSchema } from "@chia/utils/schema";

export const getFeedsWithMetaSchema = z.object({
  limit: NumericStringSchema.optional().default(20),
  nextCursor: NumericStringSchema.optional(),
  withContent: z.string().optional().default("false"),
  published: z.string().optional().default("false"),
  locale: z.enum(locale.enumValues).optional(),
  orderBy: z
    .enum([
      FeedOrderBy.CreatedAt,
      FeedOrderBy.UpdatedAt,
      FeedOrderBy.Id,
      FeedOrderBy.Slug,
    ])
    .optional()
    .default(FeedOrderBy.CreatedAt),
  ...baseInfiniteSchema.omit({
    cursor: true,
    limit: true,
    withContent: true,
    orderBy: true,
    locale: true,
  }).shape,
});

export const insertFeedTranslationRequestSchema = insertFeedTranslationSchema;

export const updateFeedRequestSchema = updateFeedSchema;

export const upsertFeedTranslationRequestSchema = z.object({
  feedId: NumericStringSchema,
  locale: z.enum(locale.enumValues),
  title: z.string().min(1).optional(),
  excerpt: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  readTime: NumericStringSchema.optional().nullable(),
});

export const upsertContentRequestSchema = z.object({
  feedTranslationId: NumericStringSchema,
  content: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  unstableSerializedSource: z.string().optional().nullable(),
});
