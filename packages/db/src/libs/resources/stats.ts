import { and, desc, eq, ilike, ne, not, or, sql } from "drizzle-orm";

import type { Locale } from "../../schemas/enums.ts";
import type { ResourceChunkKind } from "../../schemas/resources.schema.ts";
import * as schema from "../../schemas/schema.ts";
import { withDTO } from "../index.ts";

import type { ResourceRef } from "./chunk.ts";

const chunks = schema.resourceChunks;
const embeddings = schema.resourceEmbeddings;

/** Characters of `content` the list endpoints ship; the rest needs a detail read. */
const PREVIEW_LENGTH = 200;

const MAX_LIST_LIMIT = 100;

/**
 * Clamps on both sides, because only the oRPC contract validates the input today.
 *
 * A bare `Math.min` lets `0` through — which yields `LIMIT 1`, an empty page and a
 * non-null `nextCursor`, so a paging caller never terminates — and lets negatives and
 * fractions reach Postgres as an invalid `LIMIT`.
 */
const listLimit = (limit: number | undefined, fallback: number): number =>
  Math.min(
    Math.max(Math.trunc(limit ?? fallback) || fallback, 1),
    MAX_LIST_LIMIT
  );

export type ChunkEmbeddingState = "current" | "stale" | "missing";

/** The `(model, index_version)` pair a vector must match to count as current. */
export interface ResourceIndexKey {
  model: string;
  indexVersion: string;
}

export interface ResourceChunkStatusRow {
  chunkId: number;
  kind: ResourceChunkKind;
  chunkIndex: number;
  headingPath: string | null;
  tokenCount: number | null;
  contentHash: string;
  locale: Locale | null;
  published: boolean;
  deleted: boolean;
  state: ChunkEmbeddingState;
  updatedAt: Date;
}

export interface ResourceIndexCounts {
  total: number;
  current: number;
  stale: number;
  missing: number;
}

export interface RagOverview {
  counts: ResourceIndexCounts;
  bySourceType: { sourceType: string; counts: ResourceIndexCounts }[];
  byLocale: { locale: Locale | null; counts: ResourceIndexCounts }[];
  byKind: { kind: ResourceChunkKind; counts: ResourceIndexCounts }[];
  byVisibility: {
    published: boolean;
    deleted: boolean;
    counts: ResourceIndexCounts;
  }[];
}

export interface ResourceChunkListItem extends ResourceChunkStatusRow {
  sourceType: string;
  sourceId: number;
  /** Truncated `content`; the full text only comes back from `getChunkDetail`. */
  preview: string;
}

export interface ResourceChunkDetail extends ResourceChunkStatusRow {
  sourceType: string;
  sourceId: number;
  content: string;
  metadata: unknown;
  createdAt: Date;
  /** Every stored vector, so a stale key is visible rather than inferred. */
  vectors: { model: string; indexVersion: string; updatedAt: Date }[];
}

const sourceFilter = (ref: ResourceRef) =>
  and(eq(chunks.sourceType, ref.sourceType), eq(chunks.sourceId, ref.sourceId));

const hasCurrentVector = (key: ResourceIndexKey) => sql`exists (
  select 1 from ${embeddings}
  where ${embeddings.chunkId} = ${chunks.id}
    and ${embeddings.model} = ${key.model}
    and ${embeddings.indexVersion} = ${key.indexVersion}
)`;

const hasAnyVector = sql`exists (
  select 1 from ${embeddings} where ${embeddings.chunkId} = ${chunks.id}
)`;

/**
 * `stale` is "embedded under some other key", which is why it needs the second
 * existence test: without it a bumped `index_version` reads as `missing` and the
 * leftover vectors never surface for pruning.
 */
const stateColumn = (key: ResourceIndexKey) => sql<ChunkEmbeddingState>`case
  when ${hasCurrentVector(key)} then 'current'
  when ${hasAnyVector} then 'stale'
  else 'missing'
end`;

const stateFilter = (key: ResourceIndexKey, state: ChunkEmbeddingState) => {
  switch (state) {
    case "current":
      return hasCurrentVector(key);
    case "stale":
      return sql`${hasAnyVector} and not ${hasCurrentVector(key)}`;
    case "missing":
      return sql`not ${hasAnyVector}`;
  }
};

const statusColumns = (key: ResourceIndexKey) => ({
  chunkId: chunks.id,
  kind: chunks.kind,
  chunkIndex: chunks.chunkIndex,
  headingPath: chunks.headingPath,
  tokenCount: chunks.tokenCount,
  contentHash: chunks.contentHash,
  locale: chunks.locale,
  published: chunks.published,
  deleted: chunks.deleted,
  state: stateColumn(key),
  updatedAt: chunks.updatedAt,
});

const countColumns = (key: ResourceIndexKey) => ({
  total: sql<number>`(count(*))::int`,
  current: sql<number>`(count(*) filter (where ${hasCurrentVector(key)}))::int`,
  stale: sql<number>`(count(*) filter (where ${hasAnyVector} and not ${hasCurrentVector(key)}))::int`,
  missing: sql<number>`(count(*) filter (where not ${hasAnyVector}))::int`,
});

const EMPTY_COUNTS: ResourceIndexCounts = {
  total: 0,
  current: 0,
  stale: 0,
  missing: 0,
};

/** Moves the aggregate columns of a grouped row into a nested `counts`. */
const groupCounts = <T extends ResourceIndexCounts>(
  row: T
): Omit<T, keyof ResourceIndexCounts> & { counts: ResourceIndexCounts } => {
  const { total, current, stale, missing, ...rest } = row;
  return { ...rest, counts: { total, current, stale, missing } };
};

const tally = (
  rows: { state: ChunkEmbeddingState }[]
): ResourceIndexCounts => ({
  total: rows.length,
  current: rows.filter((row) => row.state === "current").length,
  stale: rows.filter((row) => row.state === "stale").length,
  missing: rows.filter((row) => row.state === "missing").length,
});

/** Per-chunk embedding state for one resource, ordered as the drawer lists it. */
export const getResourceIndexStatus = withDTO(
  async (
    db,
    dto: ResourceIndexKey & { ref: ResourceRef }
  ): Promise<{
    counts: ResourceIndexCounts;
    chunks: ResourceChunkStatusRow[];
  }> => {
    const rows = await db
      .select(statusColumns(dto))
      .from(chunks)
      .where(sourceFilter(dto.ref))
      .orderBy(chunks.kind, chunks.chunkIndex);

    return { counts: tally(rows), chunks: rows };
  }
);

/** Counts for several resources in one statement — one feed's locales at once. */
export const countResourceIndexStatus = withDTO(
  async (
    db,
    dto: ResourceIndexKey & { refs: ResourceRef[] }
  ): Promise<{ ref: ResourceRef; counts: ResourceIndexCounts }[]> => {
    if (dto.refs.length === 0) {
      return [];
    }

    const rows = await db
      .select({
        sourceType: chunks.sourceType,
        sourceId: chunks.sourceId,
        ...countColumns(dto),
      })
      .from(chunks)
      .where(or(...dto.refs.map(sourceFilter)))
      .groupBy(chunks.sourceType, chunks.sourceId);

    const byRef = new Map(
      rows.map((row) => [`${row.sourceType}:${row.sourceId}`, row])
    );

    // a ref with no chunks at all still gets an entry, as zeros
    return dto.refs.map((ref) => {
      const row = byRef.get(`${ref.sourceType}:${ref.sourceId}`);
      return {
        ref,
        counts: row ? groupCounts(row).counts : EMPTY_COUNTS,
      };
    });
  }
);

export const getRagOverview = withDTO(
  async (db, dto: ResourceIndexKey): Promise<RagOverview> => {
    const counts = countColumns(dto);

    const [overall, bySourceType, byLocale, byKind, byVisibility] =
      await Promise.all([
        db.select(counts).from(chunks),
        db
          .select({ sourceType: chunks.sourceType, ...counts })
          .from(chunks)
          .groupBy(chunks.sourceType),
        db
          .select({ locale: chunks.locale, ...counts })
          .from(chunks)
          .groupBy(chunks.locale),
        db
          .select({ kind: chunks.kind, ...counts })
          .from(chunks)
          .groupBy(chunks.kind),
        db
          .select({
            published: chunks.published,
            deleted: chunks.deleted,
            ...counts,
          })
          .from(chunks)
          .groupBy(chunks.published, chunks.deleted),
      ]);

    return {
      counts: overall[0] ?? EMPTY_COUNTS,
      bySourceType: bySourceType.map(groupCounts),
      byLocale: byLocale.map(groupCounts),
      byKind: byKind.map(groupCounts),
      byVisibility: byVisibility.map(groupCounts),
    };
  }
);

/**
 * Explorer page, keyed on a descending `id` cursor.
 *
 * `query` is a substring filter rather than BM25: paging on `id` and ordering on
 * relevance cannot both hold, and the explorer needs a stable cursor.
 */
export const listChunks = withDTO(
  async (
    db,
    dto: ResourceIndexKey & {
      sourceType?: string;
      locale?: Locale;
      kind?: ResourceChunkKind;
      state?: ChunkEmbeddingState;
      query?: string;
      cursor?: number | null;
      limit?: number;
    }
  ): Promise<{ items: ResourceChunkListItem[]; nextCursor: number | null }> => {
    const limit = listLimit(dto.limit, 50);
    const query = dto.query?.trim();

    const rows = await db
      .select({
        ...statusColumns(dto),
        sourceType: chunks.sourceType,
        sourceId: chunks.sourceId,
        preview: sql<string>`left(${chunks.content}, ${PREVIEW_LENGTH})`,
      })
      .from(chunks)
      .where(
        and(
          dto.sourceType ? eq(chunks.sourceType, dto.sourceType) : undefined,
          dto.locale ? eq(chunks.locale, dto.locale) : undefined,
          dto.kind ? eq(chunks.kind, dto.kind) : undefined,
          dto.state ? stateFilter(dto, dto.state) : undefined,
          query ? ilike(chunks.content, `%${query}%`) : undefined,
          dto.cursor == null ? undefined : sql`${chunks.id} <= ${dto.cursor}`
        )
      )
      .orderBy(desc(chunks.id))
      .limit(limit + 1);

    // the cursor is inclusive, so the extra row is where the next page starts
    return {
      items: rows.slice(0, limit),
      nextCursor: rows.length > limit ? (rows[limit]?.chunkId ?? null) : null,
    };
  }
);

export const getChunkDetail = withDTO(
  async (
    db,
    dto: ResourceIndexKey & { chunkId: number }
  ): Promise<ResourceChunkDetail | null> => {
    const [row] = await db
      .select({
        ...statusColumns(dto),
        sourceType: chunks.sourceType,
        sourceId: chunks.sourceId,
        content: chunks.content,
        metadata: chunks.metadata,
        createdAt: chunks.createdAt,
      })
      .from(chunks)
      .where(eq(chunks.id, dto.chunkId))
      .limit(1);

    if (!row) {
      return null;
    }

    const vectors = await db
      .select({
        model: embeddings.model,
        indexVersion: embeddings.indexVersion,
        updatedAt: embeddings.updatedAt,
      })
      .from(embeddings)
      .where(eq(embeddings.chunkId, dto.chunkId));

    return { ...row, vectors };
  }
);

/** Vectors per `(model, index_version)`, which is how leftover keys show up. */
export const getEmbeddingKeyDistribution = withDTO(
  async (
    db,
    _dto: Record<string, never>
  ): Promise<{ model: string; indexVersion: string; count: number }[]> => {
    return await db
      .select({
        model: embeddings.model,
        indexVersion: embeddings.indexVersion,
        count: sql<number>`(count(*))::int`,
      })
      .from(embeddings)
      .groupBy(embeddings.model, embeddings.indexVersion)
      .orderBy(desc(sql`count(*)`));
  }
);

/** The backlog `listChunksNeedingEmbedding` drains: `stale` plus `missing`. */
export const countChunksNeedingEmbedding = withDTO(
  async (db, dto: ResourceIndexKey): Promise<number> => {
    const [row] = await db
      .select({ count: sql<number>`(count(*))::int` })
      .from(chunks)
      .where(not(hasCurrentVector(dto)));

    return row?.count ?? 0;
  }
);

/** Drops every vector that is not on the current key. */
export const deleteStaleEmbeddings = withDTO(
  async (db, dto: ResourceIndexKey): Promise<{ deletedCount: number }> => {
    const deleted = await db
      .delete(embeddings)
      .where(
        or(
          ne(embeddings.model, dto.model),
          ne(embeddings.indexVersion, dto.indexVersion)
        )
      )
      .returning({ chunkId: embeddings.chunkId });

    return { deletedCount: deleted.length };
  }
);
