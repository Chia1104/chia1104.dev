import { connectDatabase } from "@chia/db/client";
import { getFeedForIndexing } from "@chia/db/repos/feeds";
import type { Locale } from "@chia/db/types";
import dayjs from "@chia/utils/day";

export interface FeedIndexingSnapshot {
  type: "post" | "note";
  slug: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  translations: {
    translationID: number;
    locale: Locale;
    title: string;
    description: string | null;
    summary: string | null;
    content: string | null;
  }[];
}

/**
 * Loads the feed snapshot every indexing branch (embeddings, reading time,
 * Algolia) is built from. Runs as a step so the workflow replays the same
 * snapshot on retries.
 */
export const loadFeedForIndexingStep = async (
  feedID: number
): Promise<FeedIndexingSnapshot | null> => {
  "use step";

  const db = await connectDatabase();
  const feed = await getFeedForIndexing(db, { feedId: feedID });
  if (!feed) {
    return null;
  }

  return {
    type: feed.type,
    slug: feed.slug,
    enabled: feed.published && !feed.deletedAt,
    createdAt: dayjs(feed.createdAt).toISOString(),
    updatedAt: dayjs(feed.updatedAt).toISOString(),
    translations: feed.translations.map((translation) => ({
      translationID: translation.id,
      locale: translation.locale,
      title: translation.title,
      description: translation.description,
      summary: translation.summary,
      content: translation.content?.content ?? null,
    })),
  };
};
