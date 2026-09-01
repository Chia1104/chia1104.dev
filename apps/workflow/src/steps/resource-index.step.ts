import "zod/compile";
import { FatalError, fetch } from "workflow";

import { resolveEmbeddingProvider } from "@chia/ai/embeddings/provider";
import { EMBEDDING_INDEX_VERSION } from "@chia/ai/embeddings/utils";
import { getResourceAdapter } from "@chia/api/resources/registry";
import { connectDatabase } from "@chia/db/client";
import {
  deleteResourceChunks,
  listChunksNeedingEmbedding,
  replaceResourceChunks,
  saveChunkEmbeddings,
} from "@chia/db/repos/resources/chunk";

const EMBED_BATCH_SIZE = 32;

export interface ResourceIndexRequest {
  sourceType: string;
  sourceId: number;
}

/** Unchanged text keeps its vectors; only new or edited chunks are rewritten. */
export const syncResourceChunksStep = async (request: ResourceIndexRequest) => {
  "use step";

  const db = await connectDatabase(undefined, { withCache: false });
  const adapter = getResourceAdapter(request.sourceType);
  const ref = { sourceType: request.sourceType, sourceId: request.sourceId };

  const chunkSet = await adapter.buildChunks(db, request.sourceId);
  if (!chunkSet || chunkSet.chunks.length === 0) {
    const { deletedCount } = await deleteResourceChunks(db, { ref });
    return { status: "cleared" as const, deletedCount };
  }

  const result = await replaceResourceChunks(db, {
    ref,
    visibility: chunkSet.visibility,
    chunks: chunkSet.chunks,
  });

  return { status: "synced" as const, ...result };
};

/**
 * Re-queries the backlog rather than paging one snapshot, so the loop terminates.
 * Provider 4xx other than 408/429 is `FatalError`.
 */
export const embedPendingChunksStep = async (request: ResourceIndexRequest) => {
  "use step";

  const db = await connectDatabase(undefined, { withCache: false });
  const provider = resolveEmbeddingProvider({ fetch });
  const ref = { sourceType: request.sourceType, sourceId: request.sourceId };

  let embedded = 0;
  while (true) {
    const batch = await listChunksNeedingEmbedding(db, {
      model: provider.id,
      indexVersion: EMBEDDING_INDEX_VERSION,
      ref,
      limit: EMBED_BATCH_SIZE,
    });
    if (batch.length === 0) {
      break;
    }

    let vectors: number[][];
    try {
      vectors = await provider.embed(
        batch.map((chunk) => chunk.content),
        "search_document"
      );
    } catch (error) {
      const status =
        error instanceof Error && "status" in error
          ? Number(error.status)
          : undefined;
      if (
        status &&
        status >= 400 &&
        status < 500 &&
        status !== 408 &&
        status !== 429
      ) {
        throw new FatalError(
          `Embedding request failed permanently (${status}): ${String(error)}`
        );
      }
      throw error;
    }

    if (vectors.length !== batch.length) {
      throw new FatalError(
        `Expected ${batch.length} embeddings, received ${vectors.length}`
      );
    }

    const { savedCount } = await saveChunkEmbeddings(db, {
      model: provider.id,
      indexVersion: EMBEDDING_INDEX_VERSION,
      rows: batch.map((chunk, index) => ({
        chunkId: chunk.id,
        embedding: vectors[index]!,
      })),
    });
    // The next query re-reads the backlog, so a batch that persisted nothing would spin forever.
    if (savedCount === 0) {
      throw new FatalError(
        `Persisted no embeddings for ${batch.length} pending chunks of ${request.sourceType}:${request.sourceId}`
      );
    }
    embedded += savedCount;
  }

  return embedded === 0
    ? { status: "up-to-date" as const, embedded: 0 }
    : { status: "embedded" as const, embedded };
};

export const clearResourceChunksStep = async (
  request: ResourceIndexRequest
) => {
  "use step";

  const db = await connectDatabase(undefined, { withCache: false });
  return await deleteResourceChunks(db, {
    ref: { sourceType: request.sourceType, sourceId: request.sourceId },
  });
};

export type ResourceIndexResult =
  | { status: "cleared"; deletedCount: number }
  | {
      status: "indexed";
      written: number;
      unchanged: number;
      /** chunks that changed position but kept their content and vectors */
      moved: number;
      removed: number;
      embedded: number;
    };

/**
 * Chunk + embed one resource. Composition, not a nested workflow, so callers already inside
 * a workflow can reuse it.
 */
export const indexResource = async (
  request: ResourceIndexRequest
): Promise<ResourceIndexResult> => {
  const synced = await syncResourceChunksStep(request);
  if (synced.status === "cleared") {
    return { status: "cleared", deletedCount: synced.deletedCount };
  }

  const { embedded } = await embedPendingChunksStep(request);

  return {
    status: "indexed",
    written: synced.written,
    unchanged: synced.unchanged,
    moved: synced.moved,
    removed: synced.removed,
    embedded,
  };
};
