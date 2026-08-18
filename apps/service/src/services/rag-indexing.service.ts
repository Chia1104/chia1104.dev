import { getRun as getWorkflowRun, start } from "workflow/api";
import type { Run } from "workflow/api";

import { resolveEmbeddingProvider } from "@chia/ai/embeddings/provider";
import { EMBEDDING_INDEX_VERSION } from "@chia/ai/embeddings/utils";
import type {
  IndexingCaller,
  IndexingService,
  IndexRunHandle,
  IndexRunSnapshot,
} from "@chia/api/orpc/services/indexing.service";
import type { DB } from "@chia/db";
import { connectDatabase } from "@chia/db/client";
import {
  claimResourceIndexRun,
  finalizeResourceIndexRun,
  getActiveResourceIndexRun,
  getResourceIndexRunByExternalId,
  listResourceIndexRuns,
  markResourceIndexRunStarted,
} from "@chia/db/repos/resources/index-run";
import type {
  ResourceIndexRunTarget,
  ResourceIndexRunTerminalStatus,
} from "@chia/db/repos/resources/index-run";
import { deleteStaleEmbeddings } from "@chia/db/repos/resources/stats";
import {
  RESOURCE_INDEX_RUN_ACTIVE_STATUSES,
  RESOURCE_INDEX_RUN_SCOPE,
  RESOURCE_INDEX_RUN_STATUS,
} from "@chia/db/schema";
import type { ResourceIndexRun, ResourceIndexRunStatus } from "@chia/db/schema";

import { feedIndexingWorkflow } from "../workflows/feed-indexing.workflow";
import { indexResourceWorkflow } from "../workflows/resource-index.workflow";
import { resourceReindexWorkflow } from "../workflows/resource-reindex.workflow";

/**
 * `IndexingService` for this app, which is the only process with a workflow runtime.
 * `orpc.factory.ts` puts it on every request context.
 *
 * What it adds over `start()`: every operator-triggered run gets a `resource_index_run`
 * row, so the dashboard can poll it, attribute it, and be handed the in-flight run instead
 * of starting a second one.
 *
 * Scope boundary: the automatic feed-event path (`feedHooks.onFeedChanged`) stays unrecorded —
 * it is a fire-and-forget side effect with no operator to attribute and nobody waiting.
 */

/** The cache-free connection: a cached read would serve a run its own stale status. */
const openDatabase = () => connectDatabase(undefined, { withCache: false });

const currentIndexKey = () => ({
  model: resolveEmbeddingProvider().id,
  indexVersion: EMBEDDING_INDEX_VERSION,
});

const isActive = (status: ResourceIndexRunStatus): boolean =>
  RESOURCE_INDEX_RUN_ACTIVE_STATUSES.includes(status);

/** The statuses that may be written as a run's final state. */
const TERMINAL_STATUSES: ResourceIndexRunTerminalStatus[] = [
  RESOURCE_INDEX_RUN_STATUS.Completed,
  RESOURCE_INDEX_RUN_STATUS.Failed,
  RESOURCE_INDEX_RUN_STATUS.Cancelled,
];

/**
 * How long a row may have no run in the world before it counts as dead.
 *
 * `start()` can return before the run is recorded: when the creation event fails but the
 * queue already accepted the run, the SDK sets `resilientStart` and the runtime re-creates
 * the record asynchronously. `exists` is false for that window even though the run is about
 * to execute, so finalizing immediately would both report a failure that did not happen and
 * free the target for a second run over the same chunks.
 */
const MISSING_RUN_GRACE_MS = 60_000;

const snapshotOf = (row: ResourceIndexRun): IndexRunSnapshot => ({
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
 * Brings a stored row in line with the workflow runtime.
 *
 * Not optional (plan §4.1): the active partial unique indexes only cover pending/running
 * rows, so a run whose process died without finalizing blocks its target for good, and the
 * operator only sees a Postgres constraint error on the next press. Every path that can
 * return an active row goes through here first.
 */
const reconcile = async (
  db: DB,
  row: ResourceIndexRun
): Promise<ResourceIndexRun> => {
  if (!isActive(row.status)) {
    return row;
  }

  try {
    const run = getWorkflowRun(row.externalRunId);

    if (!(await run.exists)) {
      if (Date.now() - row.createdAt.getTime() < MISSING_RUN_GRACE_MS) {
        return row;
      }
      // the world no longer has the run, so nothing will ever finalize it
      return await finalize(db, row, RESOURCE_INDEX_RUN_STATUS.Failed, {
        error: `Workflow run ${row.externalRunId} no longer exists.`,
      });
    }

    const status = await run.status;
    if (status === "pending" || status === "running") {
      return row;
    }

    /**
     * Anything outside the five known statuses is left alone rather than written through.
     *
     * The column is plain `text`, so an unmapped value would persist, read as inactive to
     * `isActive`, fall outside the active partial unique indexes, and free the target for a
     * second run — while the first one is still going. Holding the row is the safe default:
     * a genuinely finished run is picked up on the next poll.
     */
    if (
      !TERMINAL_STATUSES.includes(
        /* SAFETY: The producer contract guarantees this value satisfies ResourceIndexRunTerminalStatus. */ status as ResourceIndexRunTerminalStatus
      )
    ) {
      console.error(
        "Unrecognised workflow run status; leaving the row active",
        {
          runId: row.externalRunId,
          status,
        }
      );
      return row;
    }

    /**
     * The single-resource and single-feed workflows do not write the record themselves —
     * they are shared with the feed-event path, which has no record — so this is where
     * their result lands. `returnValue` resolves without polling once the run is
     * completed, and a rejection only costs us the result.
     */
    const result =
      status === "completed"
        ? await run.returnValue.catch(() => undefined)
        : undefined;

    return await finalize(db, row, status, {
      result,
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
 * Takes the target, then starts the run.
 *
 * The order is forced: `claim` needs an `external_run_id` and only `start()` mints one. So
 * an active row is reconciled first and handed back when it is genuinely in flight (plan
 * §4.1 — a repeated press joins the run rather than erroring), and otherwise the run
 * starts and the insert follows.
 *
 * That insert is what arbitrates concurrent triggers: both reach it, the partial unique
 * index lets exactly one through, and the loser cancels the run it just started. A failed
 * cancel is survivable — the loser's run resolves its record by its own run id, finds the
 * winner's row instead, and dies at `resolveReindexRunStep` rather than embedding twice.
 */
const trigger = async (
  caller: IndexingCaller,
  target: ResourceIndexRunTarget,
  startRun: () => Promise<Run<unknown>>
): Promise<IndexRunHandle> => {
  const db = await openDatabase();

  const active = await getActiveResourceIndexRun(db, target);
  if (active) {
    const reconciled = await reconcile(db, active);
    if (isActive(reconciled.status)) {
      return handleOf(reconciled, true);
    }
  }

  const run = await startRun();
  const { run: row, reused } = await claimResourceIndexRun(db, {
    ...target,
    ...currentIndexKey(),
    externalRunId: run.runId,
    triggeredBy: caller.userId,
  });

  if (reused) {
    await run.cancel().catch((cause: unknown) => {
      console.error("Could not cancel a superseded index run", {
        runId: run.runId,
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
const numericCursor = (
  cursor: string | number | null | undefined
): number | null => {
  if (cursor == null) {
    return null;
  }
  const value = Number(cursor);
  return Number.isFinite(value) ? value : null;
};

export const ragIndexingService: IndexingService = {
  indexResource(caller, input) {
    return trigger(
      caller,
      {
        scope: RESOURCE_INDEX_RUN_SCOPE.Resource,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
      () => start(indexResourceWorkflow, [input])
    );
  },

  indexFeed(caller, input) {
    return trigger(
      caller,
      { scope: RESOURCE_INDEX_RUN_SCOPE.Feed, feedId: input.feedId },
      () => start(feedIndexingWorkflow, [{ feedID: input.feedId }])
    );
  },

  reindexAll(caller, input) {
    return trigger(caller, { scope: RESOURCE_INDEX_RUN_SCOPE.All }, () =>
      start(resourceReindexWorkflow, [{ onlyMissing: input.onlyMissing }])
    );
  },

  async pruneEmbeddings() {
    const db = await openDatabase();
    return await deleteStaleEmbeddings(db, currentIndexKey());
  },

  async getRun(input) {
    const db = await openDatabase();
    const row = await getResourceIndexRunByExternalId(db, {
      externalRunId: input.runId,
    });

    return row ? snapshotOf(await reconcile(db, row)) : null;
  },

  async listRuns(input) {
    const db = await openDatabase();
    const page = await listResourceIndexRuns(db, {
      limit: input.limit,
      cursor: numericCursor(input.cursor),
    });

    const items = await Promise.all(
      page.items.map((row) => reconcile(db, row))
    );

    return { items: items.map(snapshotOf), nextCursor: page.nextCursor };
  },
};
