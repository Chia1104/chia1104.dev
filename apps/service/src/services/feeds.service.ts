import snakeCase from "lodash/snakeCase.js";

import type { createOpenAI } from "@chia/ai";
import type { OllamaEmbeddingModel } from "@chia/ai/embeddings/utils";
import { isOllamaEmbeddingModel } from "@chia/ai/embeddings/utils";
import type { TextEmbeddingModel } from "@chia/ai/embeddings/utils";
import { client as algoliaClient } from "@chia/api/algolia";
import { env } from "@chia/api/algolia/env";
import type { PublicFeedSearchItem } from "@chia/api/services/validators";
import type { DB } from "@chia/db";
import { getPublicFeedSummariesByIds } from "@chia/db/repos/feeds";
import { searchFeeds } from "@chia/db/repos/feeds/embedding";
import type { Locale } from "@chia/db/types";
import type { FeedType } from "@chia/db/types";
import type { Keyv } from "@chia/kv";

interface SearchFeedsServiceParams {
  db: DB;
  kv: Keyv;
  keyword: string | undefined;
  model: TextEmbeddingModel | OllamaEmbeddingModel | "algolia";
  locale: Locale | undefined;
  client: ReturnType<typeof createOpenAI> | undefined;
}

type VectorSearchResult = Awaited<ReturnType<typeof searchFeeds>>["items"];

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

type SearchFeedsServiceResult =
  | {
      provider: OllamaEmbeddingModel | TextEmbeddingModel;
      items: VectorSearchResult;
    }
  | {
      provider: "algolia";
      items: AlgoliaFeedHit[];
    };

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
  const { hits } = await algoliaClient.searchSingleIndex<AlgoliaFeedHit>({
    indexName: env.ALGOLIA_FEEDS_INDEX_NAME,
    searchParams: {
      query: keyword.trim(),
      facetFilters: [`locale:${locale}`],
      hitsPerPage: limit,
    },
  });

  const feedIds = [
    ...new Set(
      hits
        .map(({ feedID }) => Number(feedID))
        .filter((feedID) => Number.isSafeInteger(feedID))
    ),
  ];
  const summaries = await getPublicFeedSummariesByIds(db, {
    feedIds,
    locale,
  });
  const summariesById = new Map(
    summaries.map((summary) => [summary.id, summary])
  );

  return hits.flatMap(({ feedID }) => {
    const summary = summariesById.get(Number(feedID));
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

export async function searchFeedsService({
  db,
  kv,
  keyword,
  model,
  locale,
  client,
}: SearchFeedsServiceParams): Promise<SearchFeedsServiceResult> {
  if (model === "algolia") {
    const { hits } = await algoliaClient.searchSingleIndex<AlgoliaFeedHit>({
      indexName: env.ALGOLIA_FEEDS_INDEX_NAME,
      searchParams: {
        query: keyword ?? "",
        facetFilters: locale ? [`locale:${locale}`] : undefined,
        hitsPerPage: 5,
      },
    });
    return {
      provider: "algolia",
      items: hits,
    };
  }

  const isOllama = isOllamaEmbeddingModel(model);
  const cacheKey = `feeds:search:m:${model ?? "default"}:k:${snakeCase(keyword)}:l:${locale ?? "all"}`;
  const cached = await kv.get<string>(cacheKey);

  if (cached) {
    const { items } = await searchFeeds(db, {
      input: keyword ?? "",
      limit: 5,
      model: isOllama ? undefined : model,
      useOllama: isOllama ? { model } : undefined,
      locale,
      client,
      embedding: JSON.parse(cached) as number[],
      comparison: 0.3,
    });
    return {
      provider: model,
      items,
    };
  }

  const { items, embedding } = await searchFeeds(db, {
    input: keyword ?? "",
    limit: 5,
    model: isOllama ? undefined : model,
    useOllama: isOllama ? { model } : undefined,
    locale,
    client,
    comparison: 0.3,
  });

  await kv.set(cacheKey, JSON.stringify(embedding), 60 * 60 * 24);

  return {
    provider: model,
    items,
  };
}
