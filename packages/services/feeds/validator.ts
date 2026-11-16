import * as z from "zod";

import { feedType, locale } from "@chia/db/schema/enums";

import { ResourceSearchMode } from "../rag/resource-types";

export const searchFeedsSchema = z.object({
  keyword: z.string().trim().min(1).max(256),
  /**
   * `hybrid` fuses dense and BM25 by rank; the other two isolate one half. The embedding
   * provider is resolved server-side, so a caller cannot ask for vectors that were never
   * indexed.
   */
  model: z.enum(ResourceSearchMode).default(ResourceSearchMode.Hybrid),
});

export const publicFeedSearchItemSchema = z.object({
  feedId: z.number(),
  type: z.enum(feedType.enumValues),
  slug: z.string(),
  locale: z.enum(locale.enumValues),
  title: z.string(),
  description: z.string(),
  excerpt: z.string(),
});

export type PublicFeedSearchItem = z.infer<typeof publicFeedSearchItemSchema>;
