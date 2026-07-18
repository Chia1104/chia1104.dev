import { client } from "@chia/api/algolia";
import type { AlgoliaFeedHit } from "@chia/api/algolia/types";
import type { Locale } from "@chia/db/types";

import { env } from "../env";

const getIndexName = () =>
  process.env.ALGOLIA_FEEDS_INDEX_NAME ?? env.ALGOLIA_FEEDS_INDEX_NAME;

export interface SaveFeedToAlgoliaParams {
  feedID: number;
  objectID: number;
  type: "post" | "note";
  locale: Locale;
  slug: string;
  title: string;
  content: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  enabled: boolean;
}

/**
 * Upserts (or removes, when the feed is disabled) the translation's Algolia
 * object. Idempotent — safe to retry.
 */
export const saveFeedToAlgoliaStep = async (
  params: SaveFeedToAlgoliaParams
) => {
  "use step";

  const indexName = getIndexName();

  if (!params.enabled) {
    await client.deleteObject({
      indexName,
      objectID: params.objectID.toString(),
    });
    return { action: "deleted" as const };
  }

  await client.saveObject({
    indexName,
    body: {
      version: "2026.07.13",
      objectID: params.objectID,
      feedID: params.feedID,
      type: params.type,
      locale: params.locale,
      slug: params.slug,
      title: params.title,
      description: params.description,
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
      content: params.content,
    } satisfies AlgoliaFeedHit,
  });

  return { action: "saved" as const };
};
