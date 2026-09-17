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
}

/** One place in a resource that matched, as an agent reads it. */
export interface SearchMatch {
  /** Heading trail of the matched chunk, as stored, e.g. `"Setup > Install"`; absent on a card. */
  headingPath?: string;
  snippet: string;
}

/** A chunk is up to ~512 tokens; the first match orients, the rest only locate further sections. */
const MATCH_SNIPPET_MAX_CHARS = 500;
const FURTHER_MATCH_SNIPPET_MAX_CHARS = 200;

/**
 * The best chunk always, then each further chunk that names a section not listed yet: a card
 * or a second fragment of one section gives the reader nowhere new to go. BM25 snippets carry
 * `<b>` markers for UI highlighting, stripped because an agent reads them as prose.
 */
export const toSearchMatches = (chunks: ChunkHit[]): SearchMatch[] => {
  const seen = new Set<string>();
  return chunks.flatMap((chunk, index) => {
    const headingPath = chunk.headingPath ?? undefined;
    if (index > 0 && (!headingPath || seen.has(headingPath))) {
      return [];
    }
    if (headingPath) {
      seen.add(headingPath);
    }
    return [
      {
        headingPath,
        snippet:
          chunk.snippet?.replaceAll(/<\/?b>/g, "") ||
          truncateEnd(
            chunk.content,
            index === 0
              ? MATCH_SNIPPET_MAX_CHARS
              : FURTHER_MATCH_SNIPPET_MAX_CHARS
          ),
      },
    ];
  });
};

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
