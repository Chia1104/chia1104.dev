import type {
  MemoryDetail,
  MemoryHit,
  MemoryPort,
  MemorySummary,
  SavedMemory,
} from "@chia/agent-writing/ports";
import {
  createMemoryService,
  recordSourceMemoryService,
} from "@chia/api/memories/write";
import { AGENT_MEMORY_SOURCE_TYPE } from "@chia/api/resources/registry";
import { searchResources } from "@chia/api/resources/search";
import type { DB } from "@chia/db/client";
import {
  getAgentMemories,
  getAgentMemory,
  listActiveAgentLessons,
  listAgentMemoriesBySession,
} from "@chia/db/repos/agent/memory";
import type { AgentMemory } from "@chia/db/schema";
import { AGENT_MEMORY_KIND } from "@chia/db/schema";
import { AppError } from "@chia/service-kit/errors";

import { memoryHooks } from "./agent-memory-indexing.service";

/**
 * {@link MemoryPort} implementation.
 *
 * Writes go through `memories/write.ts` so the index run is never skipped; search goes
 * through `searchResources` with the memory type named and unpublished rows requested —
 * the two flags a caller must set together to see a memory at all, since every memory
 * chunk is indexed `published: false`.
 *
 * Takes a `DB` and the session id rather than a request: it is built inside the turn step,
 * and the session is the provenance every write records.
 */

/** A chunk is up to ~512 tokens; a hit only needs enough to orient. */
const SNIPPET_MAX_CHARS = 500;

const truncateSnippet = (content: string): string =>
  content.length <= SNIPPET_MAX_CHARS
    ? content
    : `${content.slice(0, SNIPPET_MAX_CHARS)}…`;

const summaryOf = (row: AgentMemory): MemorySummary => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  sourceUrl: row.sourceUrl,
});

export interface CreateAgentMemoryPortOptions {
  db: DB;
  /** Recorded on every write as where the memory came from. */
  sessionId: string;
}

export const createAgentMemoryPort = (
  options: CreateAgentMemoryPortOptions
): MemoryPort => {
  const { db, sessionId } = options;

  return {
    async save(input): Promise<SavedMemory> {
      if (input.kind === AGENT_MEMORY_KIND.Source) {
        if (!input.sourceUrl) {
          throw new AppError("BAD_REQUEST", {
            message: "A source memory needs its URL.",
          });
        }
        const { id, changed } = await recordSourceMemoryService(
          db,
          {
            sourceUrl: input.sourceUrl,
            title: input.title,
            content: input.content,
            sessionId,
          },
          memoryHooks
        );
        return {
          id,
          kind: input.kind,
          title: input.title,
          sourceUrl: input.sourceUrl,
          changed,
        };
      }

      const row = await createMemoryService(
        db,
        {
          kind: input.kind,
          title: input.title,
          content: input.content,
          sourceUrl: input.sourceUrl,
          sessionId,
        },
        memoryHooks
      );
      return { ...summaryOf(row), changed: true };
    },

    async search(input): Promise<MemoryHit[]> {
      const { items } = await searchResources({
        db,
        query: input.query,
        mode: "hybrid",
        sourceTypes: [AGENT_MEMORY_SOURCE_TYPE],
        includeUnpublished: true,
        limit: input.limit,
      });
      if (items.length === 0) return [];

      // the adapter's summary carries title and URL only; kind lives on the row
      const rows = await getAgentMemories(
        db,
        items.map((item) => item.sourceId)
      );
      const rowsById = new Map(rows.map((row) => [row.id, row]));

      return items.flatMap((item) => {
        const row = rowsById.get(item.sourceId);
        return row
          ? [
              {
                ...summaryOf(row),
                snippet: truncateSnippet(item.bestChunk.content),
                headingPath: item.bestChunk.headingPath,
              },
            ]
          : [];
      });
    },

    async get(id): Promise<MemoryDetail | null> {
      const row = await getAgentMemory(db, id);
      if (!row || row.deletedAt !== null) return null;
      return {
        ...summaryOf(row),
        status: row.status,
        content: row.content,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    },

    listBySession: (id) => listAgentMemoriesBySession(db, id),

    listActiveLessons: (limit) => listActiveAgentLessons(db, limit),
  };
};
