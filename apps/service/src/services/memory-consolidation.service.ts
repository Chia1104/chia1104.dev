import type { MemoryService } from "@chia/api/orpc/services/memory.service";

import { workflowControl } from "./workflow-control";

/**
 * Starts a reflection run over one session. Fire-and-forget from the writing turn, awaited
 * for its run id from the dashboard; the run reports its own outcome.
 */
export const startMemoryConsolidation = async (
  sessionId: string
): Promise<{ runId: string }> => {
  const runId = await workflowControl.startMemoryConsolidation(sessionId);
  return { runId };
};

/** `MemoryService` for this app; `WorkflowControl` owns where the run starts. */
export const memoryService: MemoryService = {
  consolidate: (_caller, input) => startMemoryConsolidation(input.sessionId),
};
