import { resolveEmbeddingProvider } from "@chia/ai/embeddings/provider";
import { EMBEDDING_INDEX_VERSION } from "@chia/ai/embeddings/utils";
import type { DB } from "@chia/db/client";
import {
  claimResourceIndexRun,
  finalizeResourceIndexRun,
  getActiveResourceIndexRun,
  markResourceIndexRunStarted,
} from "@chia/db/repos/resources/index-run";
import type {
  ResourceIndexRunTarget,
  ResourceIndexRunTerminalStatus,
} from "@chia/db/repos/resources/index-run";
import type { ResourceIndexKey } from "@chia/db/repos/resources/stats";
import {
  RESOURCE_INDEX_RUN_ACTIVE_STATUSES,
  RESOURCE_INDEX_RUN_STATUS,
} from "@chia/db/schema";
import type {
  ResourceIndexRun,
  ResourceIndexRunProgress,
  ResourceIndexRunScope,
  ResourceIndexRunStatus,
} from "@chia/db/schema";
import type { WorkflowControlClient } from "@chia/workflow-control/client";

/**
 * Operator-triggered index runs. Each gets a `resource_index_run` row so the dashboard
 * can poll it and be handed the in-flight run instead of starting a second one. The
 * automatic feed-event path stays unrecorded. Takes the request's `db` and `workflow`
 * rather than opening its own.
 */

export interface IndexRunCaller {
  /** Configured admin, already verified by `adminGuard`. */
  adminId: string;
  /** Session user id, persisted as `resource_index_run.triggered_by`. */
  userId: string;
}

export interface IndexRunHandle {
  runId: string;
  /** `resource_index_run.id`. */
  recordId: number;
  status: ResourceIndexRunStatus;
  /** True when an in-flight run was handed back instead of a new one started. */
  reused: boolean;
}

export interface IndexRunSnapshot {
  runId: string;
  recordId: number;
  scope: ResourceIndexRunScope;
  sourceType: string | null;
  sourceId: number | null;
  feedId: number | null;
  status: ResourceIndexRunStatus;
  /** The key this run embedded with, which a bumped index version makes historical. */
  model: string;
  indexVersion: string;
  progress: ResourceIndexRunProgress | null;
  result: unknown;
  error: string | null;
  triggeredBy: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
}

/** The key everything is measured against: provider id plus strategy version. */
export const currentIndexKey = (): ResourceIndexKey => ({
  model: resolveEmbeddingProvider().id,
  indexVersion: EMBEDDING_INDEX_VERSION,
});

const isActive = (status: ResourceIndexRunStatus): boolean =>
  RESOURCE_INDEX_RUN_ACTIVE_STATUSES.includes(status);

const TERMINAL_STATUSES: ResourceIndexRunTerminalStatus[] = [
  RESOURCE_INDEX_RUN_STATUS.Completed,
  RESOURCE_INDEX_RUN_STATUS.Failed,
  RESOURCE_INDEX_RUN_STATUS.Cancelled,
];

/**
 * How long a row may have no run in the World before it counts as dead. `start()` can
 * return before the run is recorded (`resilientStart`); `exists` is false for that window
 * even though the run is about to execute, so finalizing immediately would report a
 * failure that did not happen and free the target for a second run.
 */
const MISSING_RUN_GRACE_MS = 60_000;

export const snapshotOfIndexRun = (
  row: ResourceIndexRun
): IndexRunSnapshot => ({
  runId: row.externalRunId,
  recordId: row.id,
  scope: row.scope,
  sourceType: row.sourceType,
  sourceId: row.sourceId,
  feedId: row.feedId,
  status: row.status,
  model: row.model,
  indexVersion: row.indexVersion,
  progress: row.progress,
  result: row.result,
  error: row.error,
  triggeredBy: row.triggeredBy,
  startedAt: row.startedAt,
  endedAt: row.endedAt,
  createdAt: row.createdAt,
});

const handleOf = (row: ResourceIndexRun, reused: boolean): IndexRunHandle => ({
  runId: row.externalRunId,
  recordId: row.id,
  status: row.status,
  reused,
});

const finalize = async (
  db: DB,
  row: ResourceIndexRun,
  status: ResourceIndexRunTerminalStatus,
  fields: { result?: unknown; error?: string | null }
): Promise<ResourceIndexRun> =>
  (await finalizeResourceIndexRun(db, { id: row.id, status, ...fields })) ??
  row;

/**
 * Brings a stored row in line with the workflow run it tracks. The active partial unique
 * indexes only cover pending/running rows, so a run whose process died without finalizing
 * blocks its target; every path that can return an active row goes through here first.
 */
export const reconcileIndexRun = async (
  db: DB,
  workflow: WorkflowControlClient,
  row: ResourceIndexRun
): Promise<ResourceIndexRun> => {
  if (!isActive(row.status)) {
    return row;
  }

  try {
    const run = await workflow.getRun(row.externalRunId);

    if (!run.exists || !run.status) {
      if (Date.now() - row.createdAt.getTime() < MISSING_RUN_GRACE_MS) {
        return row;
      }
      // the World no longer has the run, so nothing will ever finalize it
      return await finalize(db, row, RESOURCE_INDEX_RUN_STATUS.Failed, {
        error: `Workflow run ${row.externalRunId} no longer exists.`,
      });
    }

    const status = run.status;
    if (status === "pending" || status === "running") {
      return row;
    }

    /**
     * Anything outside the known terminal statuses is left alone. The column is plain
     * `text`, so an unmapped value would persist, read as inactive, fall outside the
     * active partial unique indexes, and free the target for a second run while the
     * first is still going.
     */
    if (
      !TERMINAL_STATUSES.includes(
        /* SAFETY: The producer contract guarantees this value satisfies ResourceIndexRunTerminalStatus. */ status as ResourceIndexRunTerminalStatus
      )
    ) {
      console.error(
        "Unrecognised workflow run status; leaving the row active",
        { runId: row.externalRunId, status }
      );
      return row;
    }

    /**
     * Single-resource and single-feed workflows do not write the record themselves —
     * they are shared with the feed-event path, which has no record — so this is where
     * their result lands.
     */
    return await finalize(db, row, status, {
      result: status === "completed" ? run.output : undefined,
      error: status === "completed" ? null : `Workflow run ${status}.`,
    });
  } catch (error) {
    // A lookup failure is infrastructural; finalizing on it would bury a live run.
    console.error("Could not reconcile a resource index run", {
      runId: row.externalRunId,
      error: String(error),
    });
    return row;
  }
};

/**
 * Takes the target, then starts the run. `claim` needs an `external_run_id` and only
 * starting the run mints one. An active row is reconciled first and handed back when
 * genuinely in flight. Concurrent triggers: both reach the insert, the partial unique
 * index lets exactly one through, and the loser cancels the run it just started.
 */
export const triggerIndexRun = async (
  db: DB,
  workflow: WorkflowControlClient,
  caller: IndexRunCaller,
  target: ResourceIndexRunTarget,
  startRun: () => Promise<string>
): Promise<IndexRunHandle> => {
  const active = await getActiveResourceIndexRun(db, target);
  if (active) {
    const reconciled = await reconcileIndexRun(db, workflow, active);
    if (isActive(reconciled.status)) {
      return handleOf(reconciled, true);
    }
  }

  const runId = await startRun();
  const { run: row, reused } = await claimResourceIndexRun(db, {
    ...target,
    ...currentIndexKey(),
    externalRunId: runId,
    triggeredBy: caller.userId,
  });

  if (reused) {
    await workflow.cancelRun(runId).catch((cause: unknown) => {
      console.error("Could not cancel a superseded index run", {
        runId,
        error: String(cause),
      });
    });
    return handleOf(row, true);
  }

  // `started_at` is set here rather than inside the run: the run is enqueued at this
  // moment, and the elapsed time the operator reads starts when they pressed the button
  const started = await markResourceIndexRunStarted(db, { id: row.id });
  return handleOf(started ?? row, false);
};

/** The contract's cursor is `string | number`; the row cursor is the bigserial id. */
export const indexRunCursor = (
  cursor: string | number | null | undefined
): number | null => {
  if (cursor == null) {
    return null;
  }
  const value = Number(cursor);
  return Number.isFinite(value) ? value : null;
};
