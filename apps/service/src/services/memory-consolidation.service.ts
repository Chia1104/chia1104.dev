import { start } from "workflow/api";

import type { MemoryService } from "@chia/api/orpc/services/memory.service";

import { memoryConsolidationWorkflow } from "../workflows/memory-consolidation.workflow";

/**
 * Starts a reflection run over one session. Fire-and-forget from the writing turn, awaited
 * for its run id from the dashboard; the run reports its own outcome.
 */
export const startMemoryConsolidation = async (
  sessionId: string
): Promise<{ runId: string }> => {
  const run = await start(memoryConsolidationWorkflow, [{ sessionId }]);
  return { runId: run.runId };
};

/** `MemoryService` for this app, the only process with a workflow runtime. */
export const memoryService: MemoryService = {
  consolidate: (_caller, input) => startMemoryConsolidation(input.sessionId),
};
