import { getAgentMemory, listAgentMemories } from "@chia/db/repos/agent/memory";
import type { AgentMemory } from "@chia/db/schema";
import { AGENT_MEMORY_KIND, AGENT_MEMORY_STATUS } from "@chia/db/schema";
import { withORPCErrors } from "@chia/service-kit/adapters/orpc";
import { AppError } from "@chia/service-kit/errors";

import { removeMemoryService, updateMemoryService } from "../../memories/write";
import { adminGuard } from "../guards/admin.guard";
import { rateLimitGuard } from "../guards/rate-limit.guard";
import { requireMemoryService } from "../services/memory.service";
import type { MemoryConsolidationCaller } from "../services/memory.service";
import { contractOS } from "../utils";

/**
 * Agent memory management routes.
 *
 * **Every route is `adminGuard()`, reads included.** A memory is the writing agent's
 * unpublished research, and an active lesson is a standing instruction injected into every
 * future turn — nothing here is for anyone but the configured author.
 *
 * Writes go through `memories/write.ts` so the index run is never skipped; the hook comes
 * from the context, which only the process with a workflow runtime supplies.
 */

const callerOf = (opts: {
  context: { adminId: string; session: { user: { id: string } } };
}): MemoryConsolidationCaller => ({
  adminId: opts.context.adminId,
  userId: opts.context.session.user.id,
});

const detailOf = (row: AgentMemory) => ({
  id: row.id,
  kind: row.kind,
  status: row.status,
  title: row.title,
  content: row.content,
  sourceUrl: row.sourceUrl,
  sessionId: row.sessionId,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

// ============================================
// Reads
// ============================================

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

// ============================================
// Writes
// ============================================

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
      const row = await getAgentMemory(opts.context.db, opts.input.id);
      if (!row || row.deletedAt !== null) {
        throw new AppError("NOT_FOUND", {
          message: `Memory ${opts.input.id} not found`,
        });
      }
      if (row.kind !== AGENT_MEMORY_KIND.Lesson) {
        throw new AppError("BAD_REQUEST", {
          message: `Memory ${opts.input.id} is a ${row.kind}, not a lesson.`,
        });
      }
      const updated = await updateMemoryService(
        opts.context.db,
        { id: row.id, status: AGENT_MEMORY_STATUS.Active },
        opts.context.hooks ?? {}
      );
      return { memory: detailOf(updated) };
    })
  );

export const consolidateMemoryRoute = contractOS.memory.consolidate
  .use(adminGuard())
  .use(rateLimitGuard({ prefix: "rate-limiter:memory-consolidate" }))
  .handler((opts) =>
    withORPCErrors(
      async () =>
        await requireMemoryService(opts.context).consolidate(
          callerOf(opts),
          opts.input
        )
    )
  );
