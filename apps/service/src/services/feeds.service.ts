import type { createOpenAI } from "@chia/ai";
import type {
  OllamaEmbeddingModel,
  TextEmbeddingModel,
} from "@chia/ai/embeddings/utils";
import {
  getEmbeddingModelConfig,
  hashEmbeddingInput,
  isOllamaEmbeddingModel,
  isQueryableEmbeddingModel,
  normalizeQueryForEmbedding,
} from "@chia/ai/embeddings/utils";
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

  // only models the indexing workflow actually writes are searchable —
  // anything else would burn a query embedding and return nothing
  if (!isQueryableEmbeddingModel(model)) {
    throw new UnindexedEmbeddingModelError(model);
  }

  const config = getEmbeddingModelConfig(model);
  const isOllama = isOllamaEmbeddingModel(model);
  const cachedEmbedding = await readCachedQueryEmbedding({
    kv,
    keyword: keyword ?? "",
    model,
    locale,
  });

  const { items, embedding } = await searchFeeds(db, {
    input: keyword ?? "",
    limit: 5,
    model: isOllama ? undefined : model,
    useOllama: isOllama ? { model } : undefined,
    locale,
    client,
    embedding: cachedEmbedding ?? undefined,
    comparison: config.defaultThreshold,
  });

  if (!cachedEmbedding && embedding.length === config.dimensions) {
    await writeCachedQueryEmbedding({
      kv,
      keyword: keyword ?? "",
      model,
      locale,
      embedding,
    });
  }

  return {
    provider: model,
    items,
  };
}

// ============================================
// Query embedding cache
// ============================================

export class UnindexedEmbeddingModelError extends Error {
  constructor(readonly model: string) {
    super(`Embedding model "${model}" is not indexed for search`);
    this.name = "UnindexedEmbeddingModelError";
  }
}

const QUERY_EMBEDDING_CACHE_VERSION = "v1";
const QUERY_EMBEDDING_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedQueryEmbedding {
  model: string;
  dimensions: number;
  embedding: number[];
  createdAt: string;
}

const queryEmbeddingCacheKey = async (params: {
  keyword: string;
  model: TextEmbeddingModel | OllamaEmbeddingModel;
  locale: Locale | undefined;
}) => {
  const normalized = normalizeQueryForEmbedding(params.keyword);
  const digest = await hashEmbeddingInput(normalized);
  return `feeds:query-embedding:${QUERY_EMBEDDING_CACHE_VERSION}:${params.model}:${params.locale ?? "all"}:${digest}`;
};

const readCachedQueryEmbedding = async (params: {
  kv: Keyv;
  keyword: string;
  model: TextEmbeddingModel | OllamaEmbeddingModel;
  locale: Locale | undefined;
}): Promise<number[] | null> => {
  const cacheKey = await queryEmbeddingCacheKey(params);
  const cached = await params.kv.get<string>(cacheKey);
  if (!cached) {
    return null;
  }

  const config = getEmbeddingModelConfig(params.model);
  try {
    const payload = JSON.parse(cached) as Partial<CachedQueryEmbedding>;
    if (
      payload.model === params.model &&
      payload.dimensions === config.dimensions &&
      Array.isArray(payload.embedding) &&
      payload.embedding.length === config.dimensions &&
      payload.embedding.every(
        (value) => typeof value === "number" && Number.isFinite(value)
      )
    ) {
      return payload.embedding;
    }
  } catch {
    // fall through — corrupt payloads are deleted and regenerated
  }

  await params.kv.delete(cacheKey);
  return null;
};

const writeCachedQueryEmbedding = async (params: {
  kv: Keyv;
  keyword: string;
  model: TextEmbeddingModel | OllamaEmbeddingModel;
  locale: Locale | undefined;
  embedding: number[];
}) => {
  const cacheKey = await queryEmbeddingCacheKey(params);
  const config = getEmbeddingModelConfig(params.model);
  const payload: CachedQueryEmbedding = {
    model: params.model,
    dimensions: config.dimensions,
    embedding: params.embedding,
    createdAt: new Date().toISOString(),
  };
  await params.kv.set(
    cacheKey,
    JSON.stringify(payload),
    QUERY_EMBEDDING_CACHE_TTL_MS
  );
};
