import { resolveEmbeddingProvider } from "@chia/ai/embeddings/provider";
import type { DB } from "@chia/db/client";
import {
  aggregateChunkHits,
  searchChunksHybrid,
  searchChunksLexical,
  searchChunksSemantic,
} from "@chia/db/repos/resources/search";
import type { ChunkHit, ResourceHit } from "@chia/db/repos/resources/search";
import type { Locale } from "@chia/db/types";

import { getResourceAdapter } from "./registry";
import type { ResourceSummary } from "./types";

export type ResourceSearchMode = "hybrid" | "bm25" | "semantic";

export interface ResourceSearchHit extends ResourceHit {
  summary: ResourceSummary;
}

export interface ResourceSearchResult {
  mode: ResourceSearchMode;
  items: ResourceSearchHit[];
}

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

/** Attaches each resource's summary via its adapter, grouped by source type. */
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

export async function searchResources({
  db,
  query,
  mode = "hybrid",
  locale,
  sourceTypes,
  includeUnpublished = false,
  limit = 5,
  chunkLimit,
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
}): Promise<ResourceSearchResult> {
  const scope = { locale, sourceTypes, includeUnpublished };
  const candidates = chunkLimit ?? Math.max(limit * 6, 30);

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

  return {
    mode,
    items: await hydrate(db, aggregateChunkHits(hits, limit)),
  };
}
