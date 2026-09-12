import { getAgentMemory, listAgentMemories } from "@chia/db/repos/agent/memory";
import type { AgentMemory } from "@chia/db/schema";
import { withORPCErrors } from "@chia/service-kit/adapters/orpc";

import {
  approveLessonService,
  removeMemoryService,
  updateMemoryService,
} from "../../memories/write";
import { adminGuard } from "../guards/admin.guard";
import { contractOS } from "../utils";

/**
 * Every route is `adminGuard()`, reads included. A memory is unpublished research; an
 * active lesson is a standing instruction. Writes go through `memories/write.ts` so the
 * index run is never skipped.
 */

const detailOf = (row: AgentMemory) => ({
  id: row.id,
  kind: row.kind,
  status: row.status,
  title: row.title,
  content: row.content,
  sourceUrl: row.sourceUrl,
  sessionId: row.sessionId,
  supersedesId: row.supersedesId,
  reinforcements: row.reinforcements,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const listMemoriesRoute = contractOS.memory.list
  .use(adminGuard())
  .handler(
    async (opts) =>
      await listAgentMemories(opts.context.db, {
        ...opts.input,
        cursor: opts.input.cursor ?? null,
      })
  );

export const getMemoryRoute = contractOS.memory.get
  .use(adminGuard())
  .handler(async (opts) => {
    const row = await getAgentMemory(opts.context.db, opts.input.id);
    if (!row || row.deletedAt !== null) {
      throw opts.errors.NOT_FOUND();
    }
    return { memory: detailOf(row) };
  });

export const updateMemoryRoute = contractOS.memory.update
  .use(adminGuard())
  .handler((opts) =>
    withORPCErrors(async () => {
      const row = await updateMemoryService(
        opts.context.db,
        opts.input,
        opts.context.hooks ?? {}
      );
      return { memory: detailOf(row) };
    })
  );

export const removeMemoryRoute = contractOS.memory.remove
  .use(adminGuard())
  .handler((opts) =>
    withORPCErrors(async () => {
      await removeMemoryService(
        opts.context.db,
        opts.input,
        opts.context.hooks ?? {}
      );
      return { id: opts.input.id };
    })
  );

export const approveLessonRoute = contractOS.memory["lesson:approve"]
  .use(adminGuard())
  .handler((opts) =>
    withORPCErrors(async () => {
      const updated = await approveLessonService(
        opts.context.db,
        opts.input,
        opts.context.hooks ?? {}
      );
      return { memory: detailOf(updated) };
    })
  );

/** Starts a reflection run over one session. Fire-and-forget from the writing turn; the dashboard awaits the run id. */
export const consolidateMemoryRoute = contractOS.memory.consolidate
  .use(adminGuard())
  .handler((opts) =>
    withORPCErrors(async () => ({
      runId: await opts.context.workflow.startMemoryConsolidation(
        opts.input.sessionId
      ),
    }))
  );
