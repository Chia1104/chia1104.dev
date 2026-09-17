import * as z from "zod";

import { locale } from "@chia/db/schema/enums";
import { FeedType } from "@chia/db/types";

export const searchFeedsSchema = z.object({
  keyword: z.string().trim().min(1).max(256),
  /**
   * `hybrid` fuses dense and BM25 by rank; the other two isolate one half. The embedding
   * provider is resolved server-side, so a caller cannot ask for vectors that were never
   * indexed.
   */
  model: z.enum(["hybrid", "bm25", "semantic"]).default("hybrid"),
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
