import type { Locale, FeedType } from "@chia/db/types";

/**
 * Shape of a feed translation document in the Algolia feeds index. Written by
 * the workflow service (feed indexing) and read by the content service
 * (search) — bump `version` when the shape changes.
 */
export interface AlgoliaFeedHit {
  version: "2026.07.13";
  objectID: string | number;
  feedID: string | number;
  type: Exclude<FeedType, "all">;
  locale: Locale;
  slug: string;
  title: string;
  description: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}
