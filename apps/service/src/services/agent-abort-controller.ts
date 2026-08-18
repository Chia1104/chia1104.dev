import { getHookByToken, getRun, start } from "workflow/api";

import type { AgentAbortMessage } from "../steps/agent-abort.step";
import { agentAbortWorkflow } from "../workflows/agent-abort.workflow";
import {
  agentAbortHook,
  agentAbortToken,
} from "../workflows/hooks/agent.hooks";

/**
 * Host side of `agent-abort.workflow.ts`: find or start the controller for a session run,
 * subscribe a turn to it, and fire it. See the workflow for why this exists.
 */

/** Long enough that a parked session run rarely outlives it; expiry is harmless either way. */
const AGENT_ABORT_TTL_MS = 24 * 60 * 60 * 1000;

const controllerRunIdFor = async (
  workflowRunId: string
): Promise<string | null> => {
  const hook = await getHookByToken(agentAbortToken(workflowRunId)).catch(
    () => null
  );
  return hook?.runId ?? null;
};

/**
 * The controller run for a session run, started on first use. Only the turn step calls this, and
 * turns of one run are sequential, so two controllers for one run cannot race into existence.
 */
export const ensureAgentAbortController = async (
  workflowRunId: string
): Promise<string> => {
  const existing = await controllerRunIdFor(workflowRunId);
  if (existing) return existing;
  const run = await start(agentAbortWorkflow, [
    { workflowRunId, ttlMs: AGENT_ABORT_TTL_MS },
  ]);
  return run.runId;
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
          controller.abort(value.reason);
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
 * Fires the controller for a session run. False when the run never had one — nothing was
 * subscribed, so there is nothing to stop.
 */
export const signalAgentAbort = async (
  workflowRunId: string,
  reason: string
): Promise<boolean> => {
  if (!(await controllerRunIdFor(workflowRunId))) return false;
  try {
    await agentAbortHook.resume(agentAbortToken(workflowRunId), { reason });
    return true;
  } catch {
    // Already resumed or expired between the lookup and the resume: equally settled.
    return false;
  }
};
