import { search as pdb } from "@paradedb/drizzle-paradedb";
import { and, cosineDistance, desc, eq, inArray, or, sql } from "drizzle-orm";

import type { Locale } from "../../schemas/enums.ts";
import type { ResourceChunkKind } from "../../schemas/resources.schema.ts";
import * as schema from "../../schemas/schema.ts";
import { withDTO } from "../index.ts";

const chunks = schema.resourceChunks;
const embeddings = schema.resourceEmbeddings;

/** Standard RRF constant; larger values flatten the contribution of top ranks. */
const RRF_K = 60;

/** How many of a resource's best chunks contribute to its score. */
const RESOURCE_SCORE_TOP_N = 3;

/**
 * Weight multiplier per rank inside a resource's top-N (1, ¼, ¹⁄₁₆).
 *
 * A plain sum broke on RRF scores, which are nearly flat (rank 1 ≈ 0.016,
 * rank 30 ≈ 0.011): three mediocre chunks of a long article out-summed the
 * single top-ranked chunk of a short one, so one-section articles lost to
 * length. The decay keeps the best chunk dominant while additional relevant
 * chunks still add — breadth is rewarded, piling up is not. 0.25 measured
 * better than 0.5 on the hybrid path, which is what the API and the agent
 * actually serve; see `toolings/scripts/rag-eval`.
 */
const RESOURCE_SCORE_DECAY = 0.25;

export interface ChunkHit {
  chunkId: number;
  sourceType: string;
  sourceId: number;
  kind: ResourceChunkKind;
  chunkIndex: number;
  headingPath: string | null;
  /**
   * The chunk's stored text. Hybrid and semantic hits have no highlighted
   * snippet (ParadeDB rejects `pdb.snippet()` beside a window function), so
   * this is what shows why a chunk matched.
   */
  content: string;
  /** `<b>`-highlighted fragment, when the lexical path produced one */
  snippet: string | null;
  /** comparable only within one result set */
  score: number;
  lexicalRank: number | null;
  semanticRank: number | null;
}

export interface ResourceHit {
  sourceType: string;
  sourceId: number;
  /** decayed sum of the resource's top chunk scores */
  score: number;
  matchedChunks: number;
  /** best-scoring chunk, for citation and preview */
  bestChunk: ChunkHit;
}

interface SearchScope {
  sourceTypes?: string[];
  locale?: Locale;
  kinds?: ResourceChunkKind[];
  includeUnpublished?: boolean;
  includeDeleted?: boolean;
}

const scopeFilter = (scope?: SearchScope) =>
  and(
    scope?.includeUnpublished ? undefined : eq(chunks.published, true),
    scope?.includeDeleted ? undefined : eq(chunks.deleted, false),
    scope?.locale ? eq(chunks.locale, scope.locale) : undefined,
    scope?.sourceTypes?.length
      ? inArray(chunks.sourceType, scope.sourceTypes)
      : undefined,
    scope?.kinds?.length ? inArray(chunks.kind, scope.kinds) : undefined
  );

/**
 * `icu` for prose and whole identifiers; the `body_sub` alias reaches
 * sub-identifiers inside dotted paths, which `icu` keeps as one token.
 */
const lexicalMatch = (query: string) =>
  or(
    pdb.matchAny(chunks.content, query),
    pdb.phrase(pdb.alias(chunks.content, "body_sub"), query)
  );

const chunkColumns = {
  chunkId: chunks.id,
  sourceType: chunks.sourceType,
  sourceId: chunks.sourceId,
  kind: chunks.kind,
  chunkIndex: chunks.chunkIndex,
  headingPath: chunks.headingPath,
  content: chunks.content,
};

/**
 * Lexical-only chunk search.
 *
 * `ORDER BY` must reference `pdb.score(key_field)` directly; a select alias
 * stops ParadeDB pushing the top-K into the index.
 */
export const searchChunksLexical = withDTO(
  async (
    db,
    dto: SearchScope & { query: string; limit?: number }
  ): Promise<ChunkHit[]> => {
    const query = dto.query.trim();
    if (!query) {
      return [];
    }

    const rows = await db
      .select({
        ...chunkColumns,
        snippet: pdb.snippet(chunks.content),
        score: pdb.score(chunks.id),
      })
      .from(chunks)
      .where(and(lexicalMatch(query), scopeFilter(dto)))
      .orderBy(desc(sql`${pdb.score(chunks.id)}`))
      .limit(dto.limit ?? 20);

    return rows.map((row, index) => ({
      ...row,
      lexicalRank: index + 1,
      semanticRank: null,
    }));
  }
);

/** Dense-only chunk search for one model. */
export const searchChunksSemantic = withDTO(
  async (
    db,
    dto: SearchScope & {
      embedding: number[];
      model: string;
      limit?: number;
    }
  ): Promise<ChunkHit[]> => {
    if (dto.embedding.length === 0) {
      return [];
    }

    const similarity = sql<number>`1 - (${cosineDistance(embeddings.embedding, dto.embedding)})`;

    const rows = await db
      .select({ ...chunkColumns, score: similarity })
      .from(chunks)
      .innerJoin(
        embeddings,
        and(eq(embeddings.chunkId, chunks.id), eq(embeddings.model, dto.model))
      )
      .where(scopeFilter(dto))
      .orderBy(desc(similarity))
      .limit(dto.limit ?? 20);

    return rows.map((row, index) => ({
      ...row,
      snippet: null,
      semanticRank: index + 1,
      lexicalRank: null,
    }));
  }
);

/**
 * Hybrid chunk search in one statement, fused on rank (RRF).
 *
 * No `pdb.snippet()` in the fused query: ParadeDB rejects a snippet alongside a
 * window function. Use `searchChunksLexical` when the highlighted fragment
 * matters.
 */
export const searchChunksHybrid = withDTO(
  async (
    db,
    dto: SearchScope & {
      query: string;
      embedding: number[];
      model: string;
      limit?: number;
      /** chunks each path contributes before fusion */
      candidateLimit?: number;
    }
  ): Promise<ChunkHit[]> => {
    const query = dto.query.trim();
    if (!query && dto.embedding.length === 0) {
      return [];
    }

    const limit = dto.limit ?? 20;
    const candidateLimit = dto.candidateLimit ?? Math.max(limit * 3, 40);
    const scope = scopeFilter(dto);

    const lexical = db.$with("lexical").as(
      db
        .select({
          id: chunks.id,
          rank: sql<number>`row_number() over (order by ${pdb.score(chunks.id)} desc)`.as(
            "rank"
          ),
        })
        .from(chunks)
        .where(and(lexicalMatch(query), scope))
        .orderBy(desc(sql`${pdb.score(chunks.id)}`))
        .limit(candidateLimit)
    );

    const distance = cosineDistance(embeddings.embedding, dto.embedding);
    const semantic = db.$with("semantic").as(
      db
        .select({
          id: chunks.id,
          rank: sql<number>`row_number() over (order by ${distance})`.as(
            "rank"
          ),
        })
        .from(chunks)
        .innerJoin(
          embeddings,
          and(
            eq(embeddings.chunkId, chunks.id),
            eq(embeddings.model, dto.model)
          )
        )
        .where(scope)
        .orderBy(distance)
        .limit(candidateLimit)
    );

    const fused = db.$with("fused").as(
      db
        .select({
          id: sql<number>`coalesce(${lexical.id}, ${semantic.id})`.as("id"),
          lexicalRank: sql<number | null>`${lexical.rank}`.as("lexical_rank"),
          semanticRank: sql<number | null>`${semantic.rank}`.as(
            "semantic_rank"
          ),
          score: sql<number>`
            coalesce(1.0 / (${RRF_K} + ${lexical.rank}), 0)
            + coalesce(1.0 / (${RRF_K} + ${semantic.rank}), 0)
          `.as("score"),
        })
        // full outer join so a chunk found by only one path survives
        .from(lexical)
        .fullJoin(semantic, eq(lexical.id, semantic.id))
    );

    return await db
      .with(lexical, semantic, fused)
      .select({
        ...chunkColumns,
        snippet: sql<string | null>`null`,
        score: sql<number>`${fused.score}::float8`,
        lexicalRank: sql<number | null>`${fused.lexicalRank}`,
        semanticRank: sql<number | null>`${fused.semanticRank}`,
      })
      .from(fused)
      .innerJoin(chunks, eq(chunks.id, fused.id))
      .orderBy(desc(sql`${fused.score}`))
      .limit(limit);
  }
);

/**
 * Collapses chunk hits into one hit per resource.
 *
 * Scored on the decayed sum of a resource's top-N chunk scores
 * (`RESOURCE_SCORE_DECAY`): a resource that is relevant throughout should
 * outrank one with a single coincidentally-worded passage — under a mean a
 * second relevant chunk could only drag the score down, so breadth was never
 * rewarded — but the best chunk stays dominant so a short focused article
 * still beats a long tangential one. Comparable only within one result set,
 * like the chunk scores it sums.
 */
export const aggregateChunkHits = (
  hits: ChunkHit[],
  limit: number,
  topN = RESOURCE_SCORE_TOP_N
): ResourceHit[] => {
  const byResource = new Map<string, ChunkHit[]>();

  for (const hit of hits) {
    const key = `${hit.sourceType}:${hit.sourceId}`;
    const bucket = byResource.get(key) ?? [];
    bucket.push(hit);
    byResource.set(key, bucket);
  }

  return [...byResource.values()]
    .map((bucket) => {
      // hits arrive in score order, so the head is already the best
      const top = bucket.slice(0, topN);
      const score = top.reduce(
        (sum, hit, index) => sum + hit.score * RESOURCE_SCORE_DECAY ** index,
        0
      );
      const best = bucket[0]!;
      return {
        sourceType: best.sourceType,
        sourceId: best.sourceId,
        score,
        matchedChunks: bucket.length,
        bestChunk: best,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

/**
 * Resources most similar to a given one, compared on their card vectors.
 *
 * Cards describe the resource as a whole, so this stays a topic-level
 * comparison; section chunks would match on incidental overlap.
 */
export const findSimilarResources = withDTO(
  async (
    db,
    dto: {
      sourceType: string;
      sourceId: number;
      model: string;
      limit?: number;
      threshold?: number;
      locale?: Locale;
    }
  ) => {
    const source = db.$with("source").as(
      db
        .select({ embedding: embeddings.embedding })
        .from(chunks)
        .innerJoin(
          embeddings,
          and(
            eq(embeddings.chunkId, chunks.id),
            eq(embeddings.model, dto.model)
          )
        )
        .where(
          and(
            eq(chunks.sourceType, dto.sourceType),
            eq(chunks.sourceId, dto.sourceId),
            eq(chunks.kind, "card")
          )
        )
        .limit(1)
    );

    const similarity = sql<number>`1 - (${embeddings.embedding} <=> ${source.embedding})`;

    return await db
      .with(source)
      .select({
        sourceType: chunks.sourceType,
        sourceId: chunks.sourceId,
        similarity,
      })
      .from(source)
      .innerJoin(chunks, eq(chunks.kind, "card"))
      .innerJoin(
        embeddings,
        and(eq(embeddings.chunkId, chunks.id), eq(embeddings.model, dto.model))
      )
      .where(
        and(
          eq(chunks.published, true),
          eq(chunks.deleted, false),
          dto.locale ? eq(chunks.locale, dto.locale) : undefined,
          sql`not (${chunks.sourceType} = ${dto.sourceType} and ${chunks.sourceId} = ${dto.sourceId})`,
          dto.threshold === undefined
            ? undefined
            : sql`1 - (${embeddings.embedding} <=> ${source.embedding}) > ${dto.threshold}`
        )
      )
      .orderBy(desc(similarity))
      .limit(dto.limit ?? 3);
  }
);
