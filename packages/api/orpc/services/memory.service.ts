import { toORPCError } from "@chia/service-kit/adapters/orpc";
import { AppError } from "@chia/service-kit/errors";

import type { BaseOSContext } from "../utils";

/**
 * Port for memory consolidation.
 *
 * Everything else about memory is a plain repository call the routes make themselves;
 * consolidation *starts a workflow*, which only the host app can do. Same shape and same
 * reasoning as `IndexingService`: a process without the port answers `SERVICE_UNAVAILABLE`
 * rather than pretending to have started a run.
 */

/** Per-call context, taken from the request that triggered the run. */
export interface MemoryConsolidationCaller {
  /** Configured admin, already verified by `adminGuard`. */
  adminId: string;
  userId: string;
}

export interface MemoryService {
  /** Extracts pending lessons from one session's transcript. Returns the workflow run id. */
  consolidate(
    caller: MemoryConsolidationCaller,
    input: { sessionId: string }
  ): Promise<{ runId: string }>;
}

/** The context's memory port, or `SERVICE_UNAVAILABLE` when this process has none. */
export const requireMemoryService = (context: BaseOSContext): MemoryService => {
  if (!context.memory) {
    throw toORPCError(
      new AppError("SERVICE_UNAVAILABLE", {
        message: "Memory consolidation is not available in this process.",
      })
    );
  }
  return context.memory;
};
