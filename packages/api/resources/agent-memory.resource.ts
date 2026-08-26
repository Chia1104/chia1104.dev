import { chunkMarkdown } from "@chia/ai/embeddings/chunking";
import { hashEmbeddingInput } from "@chia/ai/embeddings/utils";
import { getAgentMemories, getAgentMemory } from "@chia/db/repos/agent/memory";
import { AGENT_MEMORY_STATUS, RESOURCE_CHUNK_KIND } from "@chia/db/schema";
import type { AgentMemory } from "@chia/db/schema";

import type {
  ChunkableResource,
  ResourceChunkInput,
  ResourceChunkSet,
  ResourceSummary,
} from "./types";

export const AGENT_MEMORY_SOURCE_TYPE = "agent_memory";

/**
 * Whether a memory still owns chunks. Shared by `buildChunks` and `hydrate`: the two must
 * agree, or a hit indexed under one rule is dropped by the other and the caller silently
 * sees one result fewer.
 */
const isRetired = (row: AgentMemory): boolean =>
  row.deletedAt !== null || row.status === AGENT_MEMORY_STATUS.Archived;

/**
 * The card is what the memory *is*, not what it says: kind, title and where it came from.
 * Bounded like a post's card, so a long fact and a short one weigh the same at topic level.
 */
const buildCard = (row: AgentMemory): string =>
  [
    `Kind: ${row.kind}`,
    `Title: ${row.title}`,
    row.sourceUrl ? `Source: ${row.sourceUrl}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join("\n");

const buildChunkSet = async (row: AgentMemory): Promise<ResourceChunkSet> => {
  const card = buildCard(row);
  const chunks: ResourceChunkInput[] = [
    {
      kind: RESOURCE_CHUNK_KIND.Card,
      chunkIndex: 0,
      content: card,
      contentHash: await hashEmbeddingInput(card),
    },
  ];

  for (const chunk of await chunkMarkdown({ content: row.content })) {
    chunks.push({
      kind: RESOURCE_CHUNK_KIND.Section,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      headingPath: chunk.headingPath,
      tokenCount: chunk.tokenCount,
      metadata:
        chunk.headingPaths.length > 1
          ? { headingPaths: chunk.headingPaths }
          : null,
      contentHash: await hashEmbeddingInput(chunk.content),
    });
  }

  return {
    // Never published: the public search path filters on `published = true`, so a memory
    // can only be read by a caller that asks for unpublished rows *and* names this type.
    // Cross-lingual by nature (sources in English, posts in Chinese), so no locale.
    visibility: { locale: null, published: false, deleted: false },
    chunks,
  };
};

export const agentMemoryResource: ChunkableResource = {
  sourceType: AGENT_MEMORY_SOURCE_TYPE,

  async buildChunks(db, sourceId) {
    const row = await getAgentMemory(db, sourceId);
    return row && !isRetired(row) ? await buildChunkSet(row) : null;
  },

  async hydrate(db, sourceIds) {
    if (sourceIds.length === 0) {
      return new Map();
    }

    const rows = await getAgentMemories(db, sourceIds);

    return new Map<number, ResourceSummary>(
      rows
        .filter((row) => !isRetired(row))
        .map((row) => [
          row.id,
          {
            sourceType: AGENT_MEMORY_SOURCE_TYPE,
            sourceId: row.id,
            title: row.title,
            description: row.sourceUrl,
            // nothing on the site to deep-link to
            href: null,
            locale: null,
          },
        ])
    );
  },
};
