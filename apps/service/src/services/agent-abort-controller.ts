import type { JsonObject } from "@chia/utils/json";
import { agentAbortControllerRefSchema } from "@chia/workflow-control/agent-hooks";
import type { AgentAbortControllerRef } from "@chia/workflow-control/agent-hooks";

import { workflowControl } from "./workflow-control";

/**
 * Host side of `agent-abort.workflow.ts`: start the controller for a session run, subscribe a
 * turn to it, and fire it. See the workflow for why this exists.
 */

/** Long enough that a parked session run rarely outlives it; expiry is harmless either way. */
const AGENT_ABORT_TTL_MS = 24 * 60 * 60 * 1000;

export type { AgentAbortControllerRef };

/** Key under which `agent.run.metadata` carries the ref, for `abort` to find it. */
export const AGENT_ABORT_CONTROLLER_KEY = "abortController";

export const readAgentAbortControllerRef = (
  metadata: JsonObject
): AgentAbortControllerRef | undefined => {
  const parsed = agentAbortControllerRefSchema.safeParse(
    metadata[AGENT_ABORT_CONTROLLER_KEY]
  );
  return parsed.success ? parsed.data : undefined;
};

/** Starts a fresh controller. Called once per session run, before that run is started. */
export const startAgentAbortController =
  async (): Promise<AgentAbortControllerRef> => {
    const id = crypto.randomUUID();
    const runId = await workflowControl.startAgentAbort({
      id,
      ttlMs: AGENT_ABORT_TTL_MS,
    });
    return { id, runId };
  };

/**
 * An `AbortSignal` that fires when the controller does. `dispose` must be called when the turn
 * ends: the subscription is a live read on a durable stream and would otherwise stay open until
 * the controller closes.
 */
/**
 * Fires a controller. False when it could not be resumed: already fired, expired, or not yet
 * registered because the controller run has not reached its hook — a window of the session run's
 * first moments, during which a stop still cancels the run but cannot reach the turn in flight.
 */
export const signalAgentAbort = async (
  controllerId: string,
  reason: string
): Promise<boolean> => {
  try {
    await workflowControl.resumeAgentAbort(controllerId, reason);
    return true;
  } catch {
    return false;
  }
};
