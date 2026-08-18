import { getRun, start } from "workflow/api";

import type { AgentAbortMessage } from "../steps/agent-abort.step";
import { agentAbortWorkflow } from "../workflows/agent-abort.workflow";
import {
  agentAbortControllerRefSchema,
  agentAbortHook,
  agentAbortToken,
} from "../workflows/hooks/agent.hooks";
import type { AgentAbortControllerRef } from "../workflows/hooks/agent.hooks";

/**
 * Host side of `agent-abort.workflow.ts`: start the controller for a session run, subscribe a
 * turn to it, and fire it. See the workflow for why this exists.
 */

/** Long enough that a parked session run rarely outlives it; expiry is harmless either way. */
const AGENT_ABORT_TTL_MS = 24 * 60 * 60 * 1000;

export type { AgentAbortControllerRef };

/** Key under which `agent_run.metadata` carries the ref, for `abort` to find it. */
export const AGENT_ABORT_CONTROLLER_KEY = "abortController";

export const readAgentAbortControllerRef = (
  metadata: Record<string, unknown>
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
    const run = await start(agentAbortWorkflow, [
      { id, ttlMs: AGENT_ABORT_TTL_MS },
    ]);
    return { id, runId: run.runId };
  };

/**
 * An `AbortSignal` that fires when the controller does. `dispose` must be called when the turn
 * ends: the subscription is a live read on a durable stream and would otherwise stay open until
 * the controller closes.
 */
export const subscribeAgentAbort = (
  controllerRunId: string
): { signal: AbortSignal; dispose: () => void } => {
  const controller = new AbortController();
  const reader = getRun(controllerRunId)
    .getReadable<AgentAbortMessage>()
    .getReader();

  void (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value.type === "abort" && !value.expired) {
          controller.abort(new DOMException(value.reason, "AbortError"));
          break;
        }
      }
    } catch {
      // A dropped subscription must not stop the turn; the abort simply cannot reach it.
    } finally {
      reader.releaseLock();
    }
  })();

  return {
    signal: controller.signal,
    dispose: () => void reader.cancel().catch(() => undefined),
  };
};

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
    await agentAbortHook.resume(agentAbortToken(controllerId), { reason });
    return true;
  } catch {
    return false;
  }
};
