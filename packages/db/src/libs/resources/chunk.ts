import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { withDTO } from "../";
import type { Locale } from "../..";
import { schema } from "../..";
import type { ResourceChunkKind } from "../../schemas/resources.schema.ts";

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
    default:
      throw new Error(`Unknown resource source type "${ref.sourceType}"`);
  }
};

const sourceFilter = (ref: ResourceRef) =>
  and(eq(chunks.sourceType, ref.sourceType), eq(chunks.sourceId, ref.sourceId));

/**
 * Replaces a resource's chunks in one transaction.
 *
 * Rows whose `content_hash` is unchanged are left alone, so their vectors
 * survive; only edited or new chunks are rewritten (which cascades their
 * vectors away) and stale positions are removed.
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

      const key = (kind: string, index: number) => `${kind}:${index}`;
      const existingByKey = new Map(
        existing.map((row) => [key(row.kind, row.chunkIndex), row])
      );

      let written = 0;
      let unchanged = 0;

      for (const chunk of dto.chunks) {
        const previous = existingByKey.get(key(chunk.kind, chunk.chunkIndex));

        if (previous?.contentHash === chunk.contentHash) {
          // text is identical; refresh only the mirrored visibility
          await trx
            .update(chunks)
            .set({
              locale: dto.visibility.locale ?? null,
              published: dto.visibility.published,
              deleted: dto.visibility.deleted,
            })
            .where(eq(chunks.id, previous.id));
          unchanged++;
          continue;
        }

        const values = {
          ...sourceColumns(dto.ref),
          kind: chunk.kind,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          headingPath: chunk.headingPath ?? null,
          tokenCount: chunk.tokenCount ?? null,
          metadata: chunk.metadata ?? null,
          contentHash: chunk.contentHash,
          locale: dto.visibility.locale ?? null,
          published: dto.visibility.published,
          deleted: dto.visibility.deleted,
        };

        if (previous) {
          // content changed — the update cascades the old vector away
          await trx
            .update(chunks)
            .set({ ...values, updatedAt: new Date() })
            .where(eq(chunks.id, previous.id));
          await trx
            .delete(embeddings)
            .where(eq(embeddings.chunkId, previous.id));
        } else {
          await trx.insert(chunks).values(values);
        }
        written++;
      }

      const keptKeys = dto.chunks.map((chunk) =>
        key(chunk.kind, chunk.chunkIndex)
      );
      const orphans = existing
        .filter((row) => !keptKeys.includes(key(row.kind, row.chunkIndex)))
        .map((row) => row.id);

      if (orphans.length > 0) {
        await trx.delete(chunks).where(inArray(chunks.id, orphans));
      }

      return { written, unchanged, removed: orphans.length };
    });
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
 *
 * Scoped to one resource when `ref` is given, otherwise a backlog query for a
 * full reindex.
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
