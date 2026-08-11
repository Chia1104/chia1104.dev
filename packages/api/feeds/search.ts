import { resolveEmbeddingProvider } from "@chia/ai/embeddings/provider";
import type { DB } from "@chia/db";
import {
  getFeedRefsByTranslationIds,
  getPublicFeedSummariesByIds,
} from "@chia/db/repos/feeds";
import { getRelatedFeeds } from "@chia/db/repos/feeds/search";
import type { Locale } from "@chia/db/types";
import type { Keyv } from "@chia/kv";

import { FEED_TRANSLATION_SOURCE_TYPE } from "../resources/registry";
import { searchResources } from "../resources/search";
import type {
  ResourceSearchHit,
  ResourceSearchMode,
  ResourceSearchResult,
} from "../resources/search";
import type { PublicFeedSearchItem } from "./validator";

export type SearchFeedsProvider = ResourceSearchMode;

/** Chunks reference translations; feed callers key off the feed. */
export interface SearchFeedsItem extends ResourceSearchHit {
  feedId: number;
  slug: string;
}

export interface SearchFeedsServiceResult
  extends Omit<ResourceSearchResult, "items"> {
  items: SearchFeedsItem[];
}

interface SearchFeedsServiceParams {
  db: DB;
  keyword: string | undefined;
  model: SearchFeedsProvider;
  locale: Locale | undefined;
  limit?: number;
  kv?: Keyv;
}

/** Feed-scoped view of resource search. */
export async function searchFeedsService({
  db,
  keyword,
  model,
  locale,
  limit = 5,
}: SearchFeedsServiceParams): Promise<SearchFeedsServiceResult> {
  const { mode, items } = await searchResources({
    db,
    query: keyword ?? "",
    mode: model,
    locale,
    sourceTypes: [FEED_TRANSLATION_SOURCE_TYPE],
    limit,
  });

  const refs = await resolveFeedRefs(
    db,
    items.map((item) => item.sourceId)
  );

  return {
    mode,
    items: items.flatMap((item) => {
      const ref = refs.get(item.sourceId);
      return ref ? [{ ...item, ...ref }] : [];
    }),
  };
}

/**
 * Public-site keyword search.
 *
 * Summaries come from the feed tables so the response keeps the shape the
 * public site renders.
 */
export async function searchPublicFeedsService({
  db,
  keyword,
  locale,
  limit = 5,
}: {
  db: DB;
  keyword: string;
  locale: Locale;
  limit?: number;
}): Promise<PublicFeedSearchItem[]> {
  const { items } = await searchResources({
    db,
    query: keyword,
    mode: "bm25",
    locale,
    sourceTypes: [FEED_TRANSLATION_SOURCE_TYPE],
    limit,
  });
  if (items.length === 0) {
    return [];
  }

  const refs = await resolveFeedRefs(
    db,
    items.map((item) => item.sourceId)
  );
  const summaries = await getPublicFeedSummariesByIds(db, {
    feedIds: [...new Set([...refs.values()].map((ref) => ref.feedId))],
    locale,
  });
  const summariesById = new Map(
    summaries.map((summary) => [summary.id, summary])
  );

  return items.flatMap((item) => {
    const ref = refs.get(item.sourceId);
    const summary = ref ? summariesById.get(ref.feedId) : undefined;
    if (!summary) {
      return [];
    }
    return [
      {
        feedId: summary.id,
        type: summary.type,
        slug: summary.slug,
        locale: summary.locale,
        title: summary.title,
        description: summary.description ?? "",
        excerpt: summary.excerpt ?? "",
      },
    ];
  });
}

const resolveFeedRefs = async (
  db: DB,
  translationIds: number[]
): Promise<Map<number, { feedId: number; slug: string }>> => {
  const rows = await getFeedRefsByTranslationIds(db, { translationIds });
  return new Map(
    rows.map((row) => [
      row.translationId,
      { feedId: row.feedId, slug: row.slug },
    ])
  );
};

// ============================================
// Related feeds
// ============================================

type RelatedFeedItems = Awaited<ReturnType<typeof getRelatedFeeds>>;

const RELATED_FEEDS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** Cached: a post's related list barely changes between publishes. */
export async function getRelatedFeedsService({
  db,
  kv,
  slug,
  locale,
  limit = 3,
}: {
  db: DB;
  kv: Keyv;
  slug: string;
  locale: Locale;
  limit?: number;
}): Promise<RelatedFeedItems> {
  const cacheKey = `feeds:related:${locale}:${slug}:${limit}`;
  const cached = await kv.get<RelatedFeedItems>(cacheKey);
  if (cached) {
    return cached;
  }

  const items = await getRelatedFeeds(db, {
    slug,
    locale,
    limit,
    model: resolveEmbeddingProvider().id,
  });
  await kv.set(cacheKey, items, RELATED_FEEDS_CACHE_TTL_MS);
  return items;
}
