import { chunkMarkdown } from "@chia/ai/embeddings/chunking";
import {
  buildEmbeddingInput,
  hashEmbeddingInput,
} from "@chia/ai/embeddings/utils";
import { getAgentMemories, getAgentMemory } from "@chia/db/repos/agent/memory";
import {
  AGENT_MEMORY_KIND,
  AGENT_MEMORY_STATUS,
  RESOURCE_CHUNK_KIND,
} from "@chia/db/schema";
import type { AgentMemory } from "@chia/db/schema";

import type {
  ChunkableResource,
  ResourceChunkInput,
  ResourceChunkSet,
  ResourceSummary,
} from "./types";

export const AGENT_MEMORY_SOURCE_TYPE = "agent_memory";

/**
 * Whether a memory owns chunks: live and `active`. A pending lesson is unreviewed, and
 * the index is agent context, so it stays out until the operator approves it. Shared by
 * `buildChunks` and `hydrate`: the two must agree or a hit is silently dropped.
 */
const isIndexable = (row: AgentMemory): boolean =>
  row.deletedAt === null && row.status === AGENT_MEMORY_STATUS.Active;

/**
 * The card is what the memory is: kind, source, and — for a page — title plus heading
 * outline. A fact or lesson has no structure to outline, so its card is identity and the
 * sections carry the text.
 */
const buildCard = async (row: AgentMemory): Promise<string> => {
  const identity = [
    `Kind: ${row.kind}`,
    row.sourceUrl ? `Source: ${row.sourceUrl}` : null,
  ].filter((part): part is string => part !== null);
  const body =
    row.kind === AGENT_MEMORY_KIND.Source
      ? await buildEmbeddingInput({ title: row.title, content: row.content })
      : `Title: ${row.title}`;
  return [...identity, body].join("\n");
};

const buildChunkSet = async (row: AgentMemory): Promise<ResourceChunkSet> => {
  const card = await buildCard(row);
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
    // can only be read by a caller that asks for unpublished rows and names this type.
    // Cross-lingual (sources in English, posts in Chinese), so no locale.
    visibility: { locale: null, published: false, deleted: false },
    chunks,
  };
};

export const agentMemoryResource: ChunkableResource = {
  sourceType: AGENT_MEMORY_SOURCE_TYPE,

  async buildChunks(db, sourceId) {
    const row = await getAgentMemory(db, sourceId);
    return row && isIndexable(row) ? await buildChunkSet(row) : null;
  },

  async hydrate(db, sourceIds) {
    if (sourceIds.length === 0) {
      return new Map();
    }

    const rows = await getAgentMemories(db, sourceIds);

    return new Map<number, ResourceSummary>(
      rows.filter(isIndexable).map((row) => [
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
