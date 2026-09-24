import {
  AGENT_TURN_KEY,
  readAgentTurnMarker,
} from "@chia/agent-host/execution";
import type { AgentTurnMarker } from "@chia/agent-host/execution";
import type { DB } from "@chia/db/client";
import {
  completeAgentRunIfUnbound,
  listRunningAgentRuns,
} from "@chia/db/repos/agent";
import { AgentRunStatus } from "@chia/db/schema";
import { logger } from "@chia/observability/logger";
import type { WorkflowControlClient } from "@chia/workflow-control/client";
import { WorkflowRunStatus } from "@chia/workflow-control/contract";

import { readAgentAbortControllerRef, signalAgentAbort } from "./abort";
import { AgentRunState } from "./agent.contract";
import type { AgentRunHost } from "./agent.factory";

/**
 * The row's turn marker says a step is executing; the World says whether that run is alive.
 * A marker on a dead run is a process that died under a step, so no reader trusts the
 * marker alone. `reconcileRunningAgentTurns` closes such rows.
 */

/** The active `agent.run` row as every state question reads it. */
export interface AgentRunRef {
  activeRunId: string | null;
  workflowRunId: string | null;
  startedAt: Date | null;
  turn: AgentTurnMarker | undefined;
}

/** Run states in which the session's workflow run can still accept a message. */
export const isRunLive = async (
  runs: AgentRunHost,
  runId: string
): Promise<boolean> => {
  try {
    const run = runs.get(runId);
    if (!(await run.exists)) return false;
    const status = await run.status;
    return (
      status === WorkflowRunStatus.Pending ||
      status === WorkflowRunStatus.Running
    );
  } catch (error) {
    // A run from a previous deployment may no longer resolve; treat it as gone.
    logger.warn({ err: error, runId }, "Run state could not be read");
    return false;
  }
};

/**
 * A run row `prompt` wrote ahead of the workflow it is about to start: its `externalRunId`
 * is still its own id. It is the session's turn lease until the started run is bound to it.
 */
export const isRunLease = (row: AgentRunRef): boolean =>
  row.activeRunId !== null && row.workflowRunId === row.activeRunId;

/**
 * How long an unbound lease counts as running. `prompt` binds within milliseconds or marks
 * the row failed; only a process that died in between leaves a lease this old.
 */
export const RUN_LEASE_TTL_MS = 60_000;

/**
 * `running` is a turn step executing; `waiting` is a live run whose turn has ended and whose
 * row is about to be closed; `null` means no live run. The SDK's own status cannot tell the
 * first two apart, so the turn marker decides.
 */
export const runStateOf = async (
  runs: AgentRunHost,
  row: AgentRunRef
): Promise<{ id: string; status: AgentRunState } | null> => {
  if (!row.workflowRunId) return null;
  if (isRunLease(row)) {
    const age = Date.now() - (row.startedAt?.getTime() ?? 0);
    return age < RUN_LEASE_TTL_MS
      ? { id: row.workflowRunId, status: AgentRunState.Running }
      : null;
  }
  if (!(await isRunLive(runs, row.workflowRunId))) return null;
  return {
    id: row.workflowRunId,
    status: row.turn?.running ? AgentRunState.Running : AgentRunState.Waiting,
  };
};

/**
 * Closes runs whose turn marker is set but whose World run is gone. Catches what the
 * workflow `finally` cannot: a row from before that `finally` existed, a run cancelled
 * from outside, a lease whose `start` never returned.
 */
export const reconcileRunningAgentTurns = async (
  db: DB,
  runs: AgentRunHost,
  workflow: WorkflowControlClient,
  userId: string
): Promise<number> => {
  const rows = await listRunningAgentRuns(db, {
    userId,
    turnKey: AGENT_TURN_KEY,
  });
  let closed = 0;
  for (const row of rows) {
    const state = await runStateOf(runs, {
      activeRunId: row.id,
      workflowRunId: row.externalRunId,
      startedAt: row.startedAt,
      turn: readAgentTurnMarker(row.metadata),
    });
    if (state?.status === AgentRunState.Running) continue;
    // Conditional on the id this verdict was read against: an executor that claimed the lease
    // since bound its real run id, and that run is alive and must not be closed from here.
    const wasClosed = await completeAgentRunIfUnbound(
      db,
      row.id,
      row.externalRunId,
      AgentRunStatus.Failed
    );
    if (!wasClosed) continue;
    // Like `completeAgentRunStep`: a dead run must not leave its controller parked until its TTL.
    const controller = readAgentAbortControllerRef(row.metadata);
    if (controller) await signalAgentAbort(workflow, controller.id, "run lost");
    closed += 1;
  }
  return closed;
};
