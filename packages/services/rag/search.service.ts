import { resolveEmbeddingProvider } from "@chia/ai/embeddings/provider";
import { resolveRerankProvider } from "@chia/ai/rerank/provider";
import type { RerankProvider } from "@chia/ai/rerank/provider";
import type { DB } from "@chia/db/client";
import {
  aggregateChunkHits,
  searchChunksHybrid,
  searchChunksLexical,
  searchChunksSemantic,
} from "@chia/db/repos/resources/search";
import type { ChunkHit, ResourceHit } from "@chia/db/repos/resources/search";
import type { Locale } from "@chia/db/types";
import { logger } from "@chia/observability/logger";
import { truncateEnd } from "@chia/utils/format";

import { getResourceAdapter } from "./registry";
import type { ResourceSummary } from "./types";

export type ResourceSearchMode = "hybrid" | "bm25" | "semantic";

export interface ResourceSearchHit extends ResourceHit {
  summary: ResourceSummary;
}

export interface ResourceSearchResult {
  mode: ResourceSearchMode;
  items: ResourceSearchHit[];
  /** The reranker's P(true) that some hit answers the query; absent when none ran. */
  answerable?: number;
}

/** One place in a resource that matched, as an agent reads it. */
export interface SearchMatch {
  /** Heading trails of the sections the matched chunk covers, as stored, e.g. `"Setup > Install"`; empty on a card. */
  headingPaths: string[];
  snippet: string;
}

/** A chunk is up to ~512 tokens; the first match orients, the rest only locate further sections. */
const MATCH_SNIPPET_MAX_CHARS = 500;
const FURTHER_MATCH_SNIPPET_MAX_CHARS = 200;

/**
 * A hit's chunks as an agent reads them. BM25 snippets carry `<b>` markers for UI
 * highlighting, stripped because an agent reads them as prose.
 */
export const toSearchMatches = (chunks: ChunkHit[]): SearchMatch[] =>
  chunks.map((chunk, index) => ({
    headingPaths: chunk.headingPaths,
    snippet:
      chunk.snippet?.replaceAll(/<\/?b>/g, "") ||
      truncateEnd(
        chunk.content,
        index === 0 ? MATCH_SNIPPET_MAX_CHARS : FURTHER_MATCH_SNIPPET_MAX_CHARS
      ),
  }));

const embedQuery = async (query: string): Promise<number[]> => {
  if (!query.trim()) {
    return [];
  }
  const [embedding] = await resolveEmbeddingProvider().embed(
    [query],
    "search_query"
  );
  return embedding ?? [];
};

const hydrate = async (
  db: DB,
  hits: ResourceHit[]
): Promise<ResourceSearchHit[]> => {
  const idsByType = new Map<string, number[]>();
  for (const hit of hits) {
    const ids = idsByType.get(hit.sourceType) ?? [];
    ids.push(hit.sourceId);
    idsByType.set(hit.sourceType, ids);
  }

  const summaries = new Map<string, ResourceSummary>();
  for (const [sourceType, ids] of idsByType) {
    const resolved = await getResourceAdapter(sourceType).hydrate(db, ids);
    for (const [sourceId, summary] of resolved) {
      summaries.set(`${sourceType}:${sourceId}`, summary);
    }
  }

  // a hit whose source is no longer visible is dropped rather than rendered
  return hits.flatMap((hit) => {
    const summary = summaries.get(`${hit.sourceType}:${hit.sourceId}`);
    return summary ? [{ ...hit, summary }] : [];
  });
};

/** Hits the reranker judges; in the fused order a query's answer has sat as deep as rank 8. */
const RERANK_CANDIDATES = 20;
/** Bounds the round trip an agent search waits for; past it the fused order stands. */
const RERANK_TIMEOUT_MS = 5_000;

const hitKey = (hit: ResourceHit): string =>
  `${hit.sourceType}:${hit.sourceId}`;

/**
 * Reorders hydrated hits by the reranker and trims to `limit`. A failed or slow
 * call keeps the fused order: a search that returns nothing because a vendor
 * stalled is worse than one ranked by RRF alone.
 */
export const rerankHits = async (
  query: string,
  items: ResourceSearchHit[],
  limit: number,
  provider: RerankProvider
): Promise<Pick<ResourceSearchResult, "items" | "answerable">> => {
  try {
    const result = await provider.rerank(
      query,
      items.map((item) => ({
        key: hitKey(item),
        title: item.summary.title,
        matches: toSearchMatches(item.chunks),
      })),
      { signal: AbortSignal.timeout(RERANK_TIMEOUT_MS) }
    );
    const byKey = new Map(items.map((item) => [hitKey(item), item]));
    const ranked = result.order.flatMap((key) => {
      const item = byKey.get(key);
      return item ? [item] : [];
    });
    // a hit the provider left out keeps its fused position behind the ranked ones
    const dropped = items.filter(
      (item) => !result.order.includes(hitKey(item))
    );
    return {
      items: [...ranked, ...dropped].slice(0, limit),
      answerable: result.answerable,
    };
  } catch (error) {
    logger.warn(
      { err: error, provider: provider.id },
      "Rerank failed; keeping the fused order"
    );
    return { items: items.slice(0, limit) };
  }
};

export async function searchResources({
  db,
  query,
  mode = "hybrid",
  locale,
  sourceTypes,
  includeUnpublished = false,
  limit = 5,
  chunkLimit,
  rerank = false,
}: {
  db: DB;
  query: string;
  mode?: ResourceSearchMode;
  locale?: Locale;
  sourceTypes?: string[];
  /** Only a caller that already passed an author check may set this. */
  includeUnpublished?: boolean;
  /** resources returned after aggregation */
  limit?: number;
  /** chunks fetched before aggregation */
  chunkLimit?: number;
  /** Reorder by the configured `RERANK_PROVIDER`; a no-op while it is `none`. */
  rerank?: boolean;
}): Promise<ResourceSearchResult> {
  const scope = { locale, sourceTypes, includeUnpublished };
  const reranker = rerank ? resolveRerankProvider() : null;
  const fetchLimit = reranker ? Math.max(limit, RERANK_CANDIDATES) : limit;
  const candidates = chunkLimit ?? Math.max(fetchLimit * 6, 30);

  let hits: ChunkHit[];
  if (mode === "bm25") {
    hits = await searchChunksLexical(db, {
      ...scope,
      query,
      limit: candidates,
    });
  } else if (mode === "semantic") {
    const provider = resolveEmbeddingProvider();
    hits = await searchChunksSemantic(db, {
      ...scope,
      embedding: await embedQuery(query),
      model: provider.id,
      limit: candidates,
    });
  } else {
    const provider = resolveEmbeddingProvider();
    hits = await searchChunksHybrid(db, {
      ...scope,
      query,
      embedding: await embedQuery(query),
      model: provider.id,
      limit: candidates,
    });
  }

  const items = await hydrate(db, aggregateChunkHits(hits, fetchLimit));
  if (!reranker) {
    return { mode, items };
  }
  return { mode, ...(await rerankHits(query, items, limit, reranker)) };
}
