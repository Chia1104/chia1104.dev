import * as z from "zod";

import { locale } from "@chia/db";
import { FeedType } from "@chia/db/types";
import { updateFeedSchema } from "@chia/db/validator/feeds";
import { NumericStringSchema } from "@chia/utils/schema";

export const searchFeedsSchema = z.object({
  keyword: z.string().trim().min(1).max(256),
  /**
   * `hybrid` fuses dense and BM25 by rank; the other two isolate one half for
   * comparison. There is no model id to pick any more — the embedding provider
   * is resolved server-side, so a caller cannot ask for vectors that were
   * never indexed.
   */
  model: z.enum(["hybrid", "bm25", "semantic"]).default("hybrid"),
});

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

export const publicFeedSearchItemSchema = z.object({
  feedId: z.number(),
  type: z.enum([FeedType.Post, FeedType.Note]),
  slug: z.string(),
  locale: z.enum(locale.enumValues),
  title: z.string(),
  description: z.string(),
  excerpt: z.string(),
});

export type PublicFeedSearchItem = z.infer<typeof publicFeedSearchItemSchema>;
