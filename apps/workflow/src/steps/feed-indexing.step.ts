import "zod/compile";
import { connectDatabase } from "@chia/db/client";
import { getFeedForIndexing } from "@chia/db/repos/feeds";
import type { Locale } from "@chia/db/types";
import dayjs from "@chia/utils/day";

export interface FeedIndexingSnapshot {
  type: "post" | "note";
  slug: string;
  /** `published && !deleted`. The flag most branches care about. */
  enabled: boolean;
  /** BM25 stores both as filterable columns. */
  published: boolean;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  translations: {
    translationID: number;
    locale: Locale;
    title: string;
    description: string | null;
    summary: string | null;
    excerpt: string | null;
    content: string | null;
    tags: string[];
  }[];
}

/** Snapshot every indexing branch is built from. A step so retries replay the same snapshot. */
export const loadFeedForIndexingStep = async (
  feedID: number
): Promise<FeedIndexingSnapshot | null> => {
  "use step";

  const db = await connectDatabase(undefined, { withCache: false });
  const feed = await getFeedForIndexing(db, { feedId: feedID });
  if (!feed) {
    return null;
  }

  // Tag names are stored per locale; fall back to every name when a locale has
  // no tag translations so the card is not silently missing its tags.
  const tagNamesByLocale = new Map<string, string[]>();
  for (const tag of feed.tags) {
    const names = tagNamesByLocale.get(tag.locale) ?? [];
    names.push(tag.name);
    tagNamesByLocale.set(tag.locale, names);
  }
  const allTagNames = [...new Set(feed.tags.map((tag) => tag.name))];

  return {
    type: feed.type,
    slug: feed.slug,
    enabled: feed.published && !feed.deletedAt,
    published: feed.published,
    deleted: !!feed.deletedAt,
    createdAt: dayjs(feed.createdAt).toISOString(),
    updatedAt: dayjs(feed.updatedAt).toISOString(),
    translations: feed.translations.map((translation) => ({
      translationID: translation.id,
      locale: translation.locale,
      title: translation.title,
      description: translation.description,
      summary: translation.summary,
      excerpt: translation.excerpt,
      content: translation.content,
      tags: tagNamesByLocale.get(translation.locale) ?? allTagNames,
    })),
  };
};
