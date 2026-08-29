import { getRun } from "workflow/api";

import {
  AGENT_TURN_KEY,
  readAgentTurnMarker,
} from "@chia/agent-host/execution";
import type { AgentTurnMarker } from "@chia/agent-host/execution";
import type { DB } from "@chia/db/client";
import { completeAgentRun, listRunningAgentRuns } from "@chia/db/repos/agent";

import {
  readAgentAbortControllerRef,
  signalAgentAbort,
} from "./agent-abort-controller.service";

/**
 * What an `agent.run` row is doing right now, as every reader must ask it.
 *
 * The row's turn marker says a step is executing; the World says whether the run that would
 * execute it is alive. A marker on a dead run is a process that died under a step — the
 * marker was never cleared — so no reader trusts the marker alone, and one reader
 * (`reconcileRunningAgentTurns`) closes such rows for good.
 */

/** The active `agent.run` row as every state question reads it. */
export interface AgentRunRef {
  activeRunId: string | null;
  workflowRunId: string | null;
  startedAt: Date | null;
  turn: AgentTurnMarker | undefined;
}

/** Run states in which the session's workflow run can still accept a message. */
export const isRunLive = async (runId: string): Promise<boolean> => {
  try {
    const run = getRun(runId);
    if (!(await run.exists)) return false;
    const status = await run.status;
    return status === "pending" || status === "running";
  } catch {
    // A run from a previous deployment may no longer resolve; treat it as gone.
    return false;
  }
};

/**
 * A run row `prompt` wrote ahead of the workflow it is about to start: its `externalRunId` is
 * still its own id. It is the session's turn lease until the started run is bound to it.
 */
export const isRunLease = (row: AgentRunRef): boolean =>
  row.activeRunId !== null && row.workflowRunId === row.activeRunId;

/**
 * How long an unbound lease counts as running. `prompt` binds within milliseconds or marks the
 * row failed; only a process that died in between leaves a lease this old, and the next prompt
 * replaces it.
 */
export const RUN_LEASE_TTL_MS = 60_000;

/**
 * What the durable run is doing right now. `running` is a turn step executing; `waiting` is the
 * run parked on its message or approval hook; `null` means no live run. The SDK's own status
 * cannot tell the first two apart — a parked run is `running` too — so the turn marker the step
 * maintains decides.
 */
export const runStateOf = async (
  row: AgentRunRef
): Promise<{ id: string; status: "running" | "waiting" } | null> => {
  if (!row.workflowRunId) return null;
  if (isRunLease(row)) {
    const age = Date.now() - (row.startedAt?.getTime() ?? 0);
    return age < RUN_LEASE_TTL_MS
      ? { id: row.workflowRunId, status: "running" }
      : null;
  }
  if (!(await isRunLive(row.workflowRunId))) return null;
  return {
    id: row.workflowRunId,
    status: row.turn?.running ? "running" : "waiting",
  };
};

/**
 * Closes the user's runs whose turn marker is set but whose World run is gone, so the running
 * count that follows is what is actually executing. Returns how many rows were closed.
 *
 * The workflow's own `finally` closes a run whose step threw; this catches what that cannot — a
 * row from before that `finally` existed, a run the World cancelled from outside, a lease whose
 * `start` never returned. Bounded: a user has at most their cap of such rows.
 */
export const reconcileRunningAgentTurns = async (
  db: DB,
  userId: string
): Promise<number> => {
  const rows = await listRunningAgentRuns(db, {
    userId,
    turnKey: AGENT_TURN_KEY,
  });
  let closed = 0;
  for (const row of rows) {
    const state = await runStateOf({
      activeRunId: row.id,
      workflowRunId: row.externalRunId,
      startedAt: row.startedAt,
      turn: readAgentTurnMarker(row.metadata),
    });
    if (state?.status === "running") continue;
    await completeAgentRun(db, row.id, "failed");
    // Like `completeAgentRunStep`: a dead run must not leave its controller parked until its TTL.
    const controller = readAgentAbortControllerRef(row.metadata);
    if (controller) await signalAgentAbort(controller.id, "run lost");
    closed += 1;
  }
  return closed;
};
