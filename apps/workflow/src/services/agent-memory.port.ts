import type {
  MemoryDetail,
  MemoryFreshness,
  MemoryPort,
  MemorySearchResult,
  MemorySummary,
  SavedMemory,
} from "@chia/agent-writing/ports";
import type { DB } from "@chia/db/client";
import {
  getAgentMemories,
  getAgentMemory,
  getChangedFactSources,
  listActiveAgentLessons,
  listAgentMemoriesBySession,
} from "@chia/db/repos/agent/memory";
import type { AgentMemory } from "@chia/db/schema";
import { AgentMemoryKind, AgentMemoryStatus } from "@chia/db/schema";
import { AppError, AppErrorCode } from "@chia/service-kit/errors";
import {
  createMemoryService,
  recordSourceMemoryService,
} from "@chia/services/memory/write.service";
import {
  ResourceSearchMode,
  ResourceType,
} from "@chia/services/rag/resource-types";
import {
  searchResources,
  toSearchMatches,
} from "@chia/services/rag/search.service";

import { memoryHooks } from "./agent-memory-indexing.service";

/**
 * Writes go through `memory/write.service.ts` so the index run is never skipped. Search uses
 * `searchResources` with the memory type and unpublished rows, both required, since memory
 * chunks are indexed `published: false`. Built with a `DB` and session id (provenance), not a request.
 */

const summaryOf = (row: AgentMemory): MemorySummary => ({
  id: row.id,
  kind: row.kind,
  status: row.status,
  title: row.title,
  sourceUrl: row.sourceUrl,
});

const freshnessOf = (
  row: AgentMemory,
  changedSources: Map<number, Date>
): MemoryFreshness => ({
  fetchedAt: row.fetchedAt?.toISOString() ?? null,
  sourceChangedAt: changedSources.get(row.id)?.toISOString() ?? null,
});

export interface CreateAgentMemoryPortOptions {
  db: DB;
  /** Provenance on every write. */
  sessionId: string;
}

export const createAgentMemoryPort = (
  options: CreateAgentMemoryPortOptions
): MemoryPort => {
  const { db, sessionId } = options;

  return {
    async save(input): Promise<SavedMemory> {
      if (input.kind === AgentMemoryKind.Source) {
        if (!input.sourceUrl) {
          throw new AppError(AppErrorCode.BadRequest, {
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
          status: AgentMemoryStatus.Active,
          title: input.title,
          sourceUrl: input.sourceUrl,
          changed,
        };
      }

      // a lesson is a proposal: pending until the operator approves it in the dashboard
      const lesson = input.kind === AgentMemoryKind.Lesson;
      const row = await createMemoryService(
        db,
        {
          kind: input.kind,
          status: lesson ? AgentMemoryStatus.Pending : undefined,
          title: input.title,
          content: input.content,
          sourceUrl: input.sourceUrl,
          sessionId,
          supersedesId: lesson ? input.supersedesId : undefined,
        },
        memoryHooks
      );
      return { ...summaryOf(row), changed: true };
    },

    async search(input): Promise<MemorySearchResult> {
      const { items, answerable } = await searchResources({
        db,
        query: input.query,
        mode: ResourceSearchMode.Hybrid,
        sourceTypes: [ResourceType.AgentMemory],
        includeUnpublished: true,
        limit: input.limit,
        rerank: true,
      });
      if (items.length === 0) return { hits: [], answerable: null };

      // The adapter's summary carries title and URL only; kind lives on the row.
      const rows = await getAgentMemories(
        db,
        items.map((item) => item.sourceId)
      );
      const rowsById = new Map(rows.map((row) => [row.id, row]));
      const changedSources = await getChangedFactSources(
        db,
        rows.map((row) => row.id)
      );

      return {
        hits: items.flatMap((item) => {
          const row = rowsById.get(item.sourceId);
          return row
            ? [
                {
                  ...summaryOf(row),
                  ...freshnessOf(row, changedSources),
                  matches: toSearchMatches(item.chunks),
                },
              ]
            : [];
        }),
        answerable: answerable ?? null,
      };
    },

    async get(id): Promise<MemoryDetail | null> {
      const row = await getAgentMemory(db, id);
      if (!row || row.deletedAt !== null) return null;
      return {
        ...summaryOf(row),
        ...freshnessOf(row, await getChangedFactSources(db, [row.id])),
        content: row.content,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    },

    listBySession: (id) => listAgentMemoriesBySession(db, id),

    listActiveLessons: (limit) => listActiveAgentLessons(db, limit),
  };
};
