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

/** Chunks embedded per provider call. */
const EMBED_BATCH_SIZE = 32;

export interface ResourceIndexRequest {
  sourceType: string;
  sourceId: number;
}

/**
 * Rebuilds a resource's chunks.
 *
 * Chunks whose text is unchanged keep their vectors; only new or edited ones
 * are rewritten, which is what makes a one-section edit cost one embedding.
 */
export const syncResourceChunksStep = async (
  request: ResourceIndexRequest
) => {
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
 * Embeds whatever chunks lack a vector for the current model and index version.
 *
 * A provider 4xx other than 408/429 is permanent, so it becomes `FatalError`
 * rather than burning the step's retries.
 */
export const embedPendingChunksStep = async (
  request: ResourceIndexRequest
) => {
  "use step";

  const db = await connectDatabase(undefined, { withCache: false });
  const provider = resolveEmbeddingProvider({ fetch });
  const ref = { sourceType: request.sourceType, sourceId: request.sourceId };

  const pending = await listChunksNeedingEmbedding(db, {
    model: provider.id,
    indexVersion: EMBEDDING_INDEX_VERSION,
    ref,
  });
  if (pending.length === 0) {
    return { status: "up-to-date" as const, embedded: 0 };
  }

  let embedded = 0;
  for (let start = 0; start < pending.length; start += EMBED_BATCH_SIZE) {
    const batch = pending.slice(start, start + EMBED_BATCH_SIZE);

    let vectors: number[][];
    try {
      vectors = await provider.embed(batch.map((chunk) => chunk.content));
    } catch (error) {
      const status =
        typeof error === "object" && error !== null && "status" in error
          ? Number((error as { status?: unknown }).status)
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
    embedded += savedCount;
  }

  return { status: "embedded" as const, embedded };
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
      removed: number;
      embedded: number;
    };

/**
 * Chunk + embed one resource.
 *
 * Composition rather than a workflow of its own so callers that already run
 * inside a workflow — the feed pipeline, for instance — reuse it without
 * nesting runs.
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
    removed: synced.removed,
    embedded,
  };
};
