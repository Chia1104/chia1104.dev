import type {
  ResourceIndexRunProgress,
  ResourceIndexRunScope,
  ResourceIndexRunStatus,
} from "@chia/db/schema";
import { AppError } from "@chia/service-kit/errors";

/**
 * Registration seam for resource indexing.
 *
 * The oRPC routes live here in `packages/api`, but *starting* an index run needs the
 * workflow runtime, which only exists in the host app. So this module declares the port
 * and `apps/service` registers an implementation at module load, exactly like
 * `./agent-runtime.ts`.
 *
 * Unlike the listeners in `./events.ts`, a missing implementation throws rather than
 * silently doing nothing: a feed event is a fire-and-forget side effect, whereas every
 * method here has a caller waiting on a run handle, so silence would render as a
 * trigger that succeeded and never ran.
 */

/** Per-call context, taken from the request that triggered the run. */
export interface IndexingCaller {
  /** Configured admin, already verified by `adminGuard`. */
  adminId: string;
  /** Session user id, persisted as `resource_index_run.triggered_by`. */
  userId: string;
}

export interface IndexRunHandle {
  /** Workflow runtime run id, and the handle `getRun` takes. */
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

export interface IndexingService {
  indexResource(
    caller: IndexingCaller,
    input: { sourceType: string; sourceId: number }
  ): Promise<IndexRunHandle>;

  indexFeed(
    caller: IndexingCaller,
    input: { feedId: number }
  ): Promise<IndexRunHandle>;

  /**
   * `onlyMissing` tops up the vectors of chunks that lack one on the current key;
   * `false` rebuilds every chunk first, which is what a bumped index version needs.
   */
  reindexAll(
    caller: IndexingCaller,
    input: { onlyMissing: boolean }
  ): Promise<IndexRunHandle>;

  /** Drops the vectors that are not on the current key. */
  pruneEmbeddings(caller: IndexingCaller): Promise<{ deletedCount: number }>;

  /**
   * Reconciles the stored row against the workflow runtime before returning it.
   *
   * Required rather than nice-to-have: the active partial unique indexes on
   * `resource_index_run` keep blocking new triggers for as long as a row that died
   * without finalizing still reads as `pending`/`running`.
   */
  getRun(input: { runId: string }): Promise<IndexRunSnapshot | null>;

  /** Reconciles every active row it is about to return, as {@link getRun} does. */
  listRuns(input: {
    limit?: number;
    cursor?: string | number | null;
  }): Promise<{
    items: IndexRunSnapshot[];
    nextCursor: string | number | null;
  }>;
}

let service: IndexingService | undefined;

export const registerIndexingService = (
  implementation: IndexingService
): void => {
  service = implementation;
};

export const getIndexingService = (): IndexingService => {
  if (!service) {
    throw new AppError("SERVICE_UNAVAILABLE", {
      message:
        "No indexing service registered. The host app must call " +
        "registerIndexingService(impl) at startup — see " +
        "apps/service/src/services/rag-indexing.service.ts.",
    });
  }
  return service;
};

/** Test helper — drops the registered implementation. */
export const resetIndexingService = (): void => {
  service = undefined;
};
