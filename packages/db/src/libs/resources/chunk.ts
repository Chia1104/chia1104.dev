import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import type { Locale } from "../../schemas/enums.ts";
import type { ResourceChunkKind } from "../../schemas/resources.schema.ts";
import * as schema from "../../schemas/schema.ts";
import { withDTO } from "../index.ts";

const chunks = schema.resourceChunks;
const embeddings = schema.resourceEmbeddings;

/** Identifies a resource without the caller knowing which key column holds it. */
export interface ResourceRef {
  sourceType: string;
  sourceId: number;
}

export interface ResourceChunkInput {
  kind: ResourceChunkKind;
  chunkIndex: number;
  content: string;
  headingPath?: string | null;
  tokenCount?: number | null;
  metadata?: unknown;
  contentHash: string;
}

export interface ResourceVisibility {
  locale?: Locale | null;
  published: boolean;
  deleted: boolean;
}

/**
 * Maps a `ResourceRef` onto the nullable key column that stores it.
 * Extend alongside `CHUNK_SOURCE_COLUMNS` in the schema.
 */
const sourceColumns = (ref: ResourceRef) => {
  switch (ref.sourceType) {
    case "feed_translation":
      return { feedTranslationId: ref.sourceId };
    case "agent_memory":
      return { agentMemoryId: ref.sourceId };
    default:
      throw new Error(`Unknown resource source type "${ref.sourceType}"`);
  }
};

const sourceFilter = (ref: ResourceRef) =>
  and(eq(chunks.sourceType, ref.sourceType), eq(chunks.sourceId, ref.sourceId));

export interface ExistingChunkRow {
  id: number;
  kind: string;
  chunkIndex: number;
  contentHash: string;
}

export interface ChunkReplacementPlan {
  /** Same kind, index and hash; only mirrored visibility is refreshed. */
  unchanged: number[];
  /** Same content at a new position; the row moves and its vectors survive. */
  moved: { id: number; chunk: ResourceChunkInput }[];
  /** New content at an existing position; rewritten in place, vectors dropped. */
  rewritten: { id: number; chunk: ResourceChunkInput }[];
  inserted: ResourceChunkInput[];
  removed: number[];
}

/**
 * Matches incoming chunks to existing rows by content, not position, so a shifted paragraph keeps its vectors.
 * Duplicate hashes are claimed row-by-row.
 */
export const planChunkReplacement = (
  existing: ExistingChunkRow[],
  incoming: ResourceChunkInput[]
): ChunkReplacementPlan => {
  const claimedRows = new Set<number>();
  const matched = new Map<ResourceChunkInput, ExistingChunkRow>();

  const claimWith = (
    keyOf: (entry: {
      kind: string;
      chunkIndex: number;
      contentHash: string;
    }) => string
  ) => {
    const pool = new Map<string, ExistingChunkRow[]>();
    for (const row of existing) {
      if (claimedRows.has(row.id)) {
        continue;
      }
      const key = keyOf(row);
      pool.set(key, [...(pool.get(key) ?? []), row]);
    }
    for (const chunk of incoming) {
      if (matched.has(chunk)) {
        continue;
      }
      const row = pool.get(keyOf(chunk))?.shift();
      if (row) {
        claimedRows.add(row.id);
        matched.set(chunk, row);
      }
    }
  };

  claimWith(
    (entry) => `${entry.kind}:${entry.chunkIndex}:${entry.contentHash}`
  );
  claimWith((entry) => `${entry.kind}:${entry.contentHash}`);
  claimWith((entry) => `${entry.kind}:${entry.chunkIndex}`);

  const plan: ChunkReplacementPlan = {
    unchanged: [],
    moved: [],
    rewritten: [],
    inserted: [],
    removed: existing
      .filter((row) => !claimedRows.has(row.id))
      .map((row) => row.id),
  };

  for (const chunk of incoming) {
    const row = matched.get(chunk);
    if (!row) {
      plan.inserted.push(chunk);
    } else if (row.contentHash !== chunk.contentHash) {
      plan.rewritten.push({ id: row.id, chunk });
    } else if (row.chunkIndex !== chunk.chunkIndex) {
      plan.moved.push({ id: row.id, chunk });
    } else {
      plan.unchanged.push(row.id);
    }
  }

  return plan;
};

/**
 * Replaces a resource's chunks in one transaction, per `planChunkReplacement`.
 * Moves land in two phases because of the unique `(source, kind, chunk_index)` index: each moved row first parks on `-(index + 1)` (real indexes are ≥ 0) then takes its final position after inserts.
 */
export const replaceResourceChunks = withDTO(
  async (
    db,
    dto: {
      ref: ResourceRef;
      visibility: ResourceVisibility;
      chunks: ResourceChunkInput[];
    }
  ) => {
    return await db.transaction(async (trx) => {
      const existing = await trx
        .select({
          id: chunks.id,
          kind: chunks.kind,
          chunkIndex: chunks.chunkIndex,
          contentHash: chunks.contentHash,
        })
        .from(chunks)
        .where(sourceFilter(dto.ref));

      const plan = planChunkReplacement(existing, dto.chunks);

      const visibility = {
        locale: dto.visibility.locale ?? null,
        published: dto.visibility.published,
        deleted: dto.visibility.deleted,
      };
      const fieldsOf = (chunk: ResourceChunkInput) => ({
        chunkIndex: chunk.chunkIndex,
        headingPath: chunk.headingPath ?? null,
        tokenCount: chunk.tokenCount ?? null,
        metadata: chunk.metadata ?? null,
        ...visibility,
        updatedAt: new Date(),
      });

      if (plan.removed.length > 0) {
        await trx.delete(chunks).where(inArray(chunks.id, plan.removed));
      }

      if (plan.unchanged.length > 0) {
        await trx
          .update(chunks)
          .set(visibility)
          .where(inArray(chunks.id, plan.unchanged));
      }

      // phase one: park every moved row off the index space
      for (const move of plan.moved) {
        await trx
          .update(chunks)
          .set({ chunkIndex: -(move.chunk.chunkIndex + 1) })
          .where(eq(chunks.id, move.id));
      }

      for (const rewrite of plan.rewritten) {
        await trx
          .update(chunks)
          .set({
            ...fieldsOf(rewrite.chunk),
            content: rewrite.chunk.content,
            contentHash: rewrite.chunk.contentHash,
          })
          .where(eq(chunks.id, rewrite.id));
        // Content changed; the stored vector no longer describes it.
        await trx.delete(embeddings).where(eq(embeddings.chunkId, rewrite.id));
      }

      if (plan.inserted.length > 0) {
        await trx.insert(chunks).values(
          plan.inserted.map((chunk) => ({
            ...sourceColumns(dto.ref),
            kind: chunk.kind,
            content: chunk.content,
            contentHash: chunk.contentHash,
            ...fieldsOf(chunk),
          }))
        );
      }

      // phase two: land the moved rows on their final indexes, vectors intact
      for (const move of plan.moved) {
        await trx
          .update(chunks)
          .set(fieldsOf(move.chunk))
          .where(eq(chunks.id, move.id));
      }

      return {
        written: plan.rewritten.length + plan.inserted.length,
        unchanged: plan.unchanged.length,
        moved: plan.moved.length,
        removed: plan.removed.length,
      };
    });
  }
);

/**
 * Whether the index reflects a source row last written at `since`.
 * `replaceResourceChunks` touches every surviving chunk's `updated_at`, so one chunk written after the row is proof the run landed.
 */
export const isResourceIndexedSince = withDTO(
  async (db, dto: { ref: ResourceRef; since: Date }): Promise<boolean> => {
    const [row] = await db
      .select({ id: chunks.id })
      .from(chunks)
      .where(and(sourceFilter(dto.ref), gte(chunks.updatedAt, dto.since)))
      .limit(1);
    return row !== undefined;
  }
);

export const deleteResourceChunks = withDTO(
  async (db, dto: { ref: ResourceRef }) => {
    const deleted = await db
      .delete(chunks)
      .where(sourceFilter(dto.ref))
      .returning({ id: chunks.id });
    return { deletedCount: deleted.length };
  }
);

/**
 * Chunks with no vector for this model and index version.
 * Scoped to one resource when `ref` is given, otherwise a backlog query for a full reindex.
 */
export const listChunksNeedingEmbedding = withDTO(
  async (
    db,
    dto: {
      model: string;
      indexVersion: string;
      ref?: ResourceRef;
      limit?: number;
    }
  ) => {
    return await db
      .select({
        id: chunks.id,
        sourceType: chunks.sourceType,
        sourceId: chunks.sourceId,
        kind: chunks.kind,
        chunkIndex: chunks.chunkIndex,
        content: chunks.content,
        headingPath: chunks.headingPath,
      })
      .from(chunks)
      .leftJoin(
        embeddings,
        and(
          eq(embeddings.chunkId, chunks.id),
          eq(embeddings.model, dto.model),
          eq(embeddings.indexVersion, dto.indexVersion)
        )
      )
      .where(
        and(
          isNull(embeddings.chunkId),
          dto.ref ? sourceFilter(dto.ref) : undefined
        )
      )
      .limit(dto.limit ?? 200);
  }
);

export const saveChunkEmbeddings = withDTO(
  async (
    db,
    dto: {
      model: string;
      indexVersion: string;
      rows: { chunkId: number; embedding: number[] }[];
    }
  ) => {
    if (dto.rows.length === 0) {
      return { savedCount: 0 };
    }

    const saved = await db
      .insert(embeddings)
      .values(
        dto.rows.map((row) => ({
          chunkId: row.chunkId,
          model: dto.model,
          indexVersion: dto.indexVersion,
          embedding: row.embedding,
        }))
      )
      .onConflictDoUpdate({
        target: [embeddings.chunkId, embeddings.model],
        set: {
          indexVersion: dto.indexVersion,
          embedding: sql`excluded.embedding`,
          updatedAt: new Date(),
        },
      })
      .returning({ chunkId: embeddings.chunkId });

    return { savedCount: saved.length };
  }
);

/** Mirrors a source's visibility onto its chunks. */
export const syncChunkVisibility = withDTO(
  async (db, dto: { ref: ResourceRef; visibility: ResourceVisibility }) => {
    const rows = await db
      .update(chunks)
      .set({
        locale: dto.visibility.locale ?? null,
        published: dto.visibility.published,
        deleted: dto.visibility.deleted,
      })
      .where(sourceFilter(dto.ref))
      .returning({ id: chunks.id });
    return { updatedCount: rows.length };
  }
);

export const countResourceChunks = withDTO(
  async (db, dto: { ref: ResourceRef }) => {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chunks)
      .where(sourceFilter(dto.ref));
    return row?.count ?? 0;
  }
);
