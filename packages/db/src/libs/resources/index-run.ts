import { and, desc, eq, inArray, isNull, lte } from "drizzle-orm";

import { withDTO } from "../";
import { schema } from "../..";
import {
  RESOURCE_INDEX_RUN_ACTIVE_STATUSES,
  RESOURCE_INDEX_RUN_SCOPE,
  RESOURCE_INDEX_RUN_STATUS,
} from "../../schemas/resources.schema.ts";
import type {
  ResourceIndexRun,
  ResourceIndexRunProgress,
  ResourceIndexRunScope,
  ResourceIndexRunStatus,
} from "../../schemas/resources.schema.ts";

const runs = schema.resourceIndexRuns;

const MAX_LIST_LIMIT = 100;

/** What a run occupies, and therefore what a duplicate trigger collides with. */
export interface ResourceIndexRunTarget {
  scope: ResourceIndexRunScope;
  sourceType?: string | null;
  sourceId?: number | null;
  feedId?: number | null;
}

export type ResourceIndexRunTerminalStatus = Extract<
  ResourceIndexRunStatus,
  "completed" | "failed" | "cancelled"
>;

export type ResourceIndexRunIdentifier =
  | { id: number }
  | { externalRunId: string };

const identifierFilter = (identifier: ResourceIndexRunIdentifier) =>
  "id" in identifier
    ? eq(runs.id, identifier.id)
    : eq(runs.externalRunId, identifier.externalRunId);

/**
 * Matches the row a target owns.
 *
 * The `isNull` branches are not defensive padding: a partial unique index never
 * conflicts on a NULL key, so a target that arrives without one has to look for
 * a NULL row or it would miss the run it just failed to insert.
 */
const targetFilter = (target: ResourceIndexRunTarget) => {
  switch (target.scope) {
    case RESOURCE_INDEX_RUN_SCOPE.Resource:
      return and(
        eq(runs.scope, target.scope),
        target.sourceType == null
          ? isNull(runs.sourceType)
          : eq(runs.sourceType, target.sourceType),
        target.sourceId == null
          ? isNull(runs.sourceId)
          : eq(runs.sourceId, target.sourceId)
      );
    case RESOURCE_INDEX_RUN_SCOPE.Feed:
      return and(
        eq(runs.scope, target.scope),
        target.feedId == null
          ? isNull(runs.feedId)
          : eq(runs.feedId, target.feedId)
      );
    case RESOURCE_INDEX_RUN_SCOPE.All:
      return eq(runs.scope, target.scope);
  }
};

const activeFilter = (target: ResourceIndexRunTarget) =>
  and(
    targetFilter(target),
    inArray(runs.status, RESOURCE_INDEX_RUN_ACTIVE_STATUSES)
  );

/**
 * Takes the target, or hands back the run already holding it.
 *
 * `onConflictDoNothing` without a target covers all three active partial unique
 * indexes at once, so a second press of the same button becomes `reused: true`
 * instead of a constraint error. A conflict with no active row left means the
 * other run finalized in between, so the insert gets one more attempt.
 */
export const claimResourceIndexRun = withDTO(
  async (
    db,
    dto: ResourceIndexRunTarget & {
      externalRunId: string;
      model: string;
      indexVersion: string;
      triggeredBy?: string | null;
    }
  ): Promise<{ run: ResourceIndexRun; reused: boolean }> => {
    const values = {
      externalRunId: dto.externalRunId,
      scope: dto.scope,
      sourceType: dto.sourceType ?? null,
      sourceId: dto.sourceId ?? null,
      feedId: dto.feedId ?? null,
      model: dto.model,
      indexVersion: dto.indexVersion,
      triggeredBy: dto.triggeredBy ?? null,
    };

    for (let attempt = 0; attempt < 2; attempt++) {
      const [inserted] = await db
        .insert(runs)
        .values(values)
        .onConflictDoNothing()
        .returning();

      if (inserted) {
        return { run: inserted, reused: false };
      }

      const [active] = await db
        .select()
        .from(runs)
        .where(activeFilter(dto))
        .orderBy(desc(runs.id))
        .limit(1);

      if (active) {
        return { run: active, reused: true };
      }
    }

    throw new Error(`Could not claim a "${dto.scope}" resource index run`);
  }
);

export const getResourceIndexRunByExternalId = withDTO(
  async (
    db,
    dto: { externalRunId: string }
  ): Promise<ResourceIndexRun | null> => {
    const [row] = await db
      .select()
      .from(runs)
      .where(eq(runs.externalRunId, dto.externalRunId))
      .orderBy(desc(runs.id))
      .limit(1);

    return row ?? null;
  }
);

export const getActiveResourceIndexRun = withDTO(
  async (db, dto: ResourceIndexRunTarget): Promise<ResourceIndexRun | null> => {
    const [row] = await db
      .select()
      .from(runs)
      .where(activeFilter(dto))
      .orderBy(desc(runs.id))
      .limit(1);

    return row ?? null;
  }
);

export const listResourceIndexRuns = withDTO(
  async (
    db,
    dto: {
      limit?: number;
      cursor?: number | null;
      scope?: ResourceIndexRunScope;
      status?: ResourceIndexRunStatus;
    }
  ): Promise<{ items: ResourceIndexRun[]; nextCursor: number | null }> => {
    const limit = Math.min(dto.limit ?? 20, MAX_LIST_LIMIT);

    const rows = await db
      .select()
      .from(runs)
      .where(
        and(
          dto.scope ? eq(runs.scope, dto.scope) : undefined,
          dto.status ? eq(runs.status, dto.status) : undefined,
          dto.cursor == null ? undefined : lte(runs.id, dto.cursor)
        )
      )
      .orderBy(desc(runs.id))
      .limit(limit + 1);

    // the cursor is inclusive, so the extra row is where the next page starts
    return {
      items: rows.slice(0, limit),
      nextCursor: rows.length > limit ? (rows[limit]?.id ?? null) : null,
    };
  }
);

/** Guarded on an active status so a reconciled run is never resurrected. */
export const markResourceIndexRunStarted = withDTO(
  async (
    db,
    dto: ResourceIndexRunIdentifier
  ): Promise<ResourceIndexRun | null> => {
    const [row] = await db
      .update(runs)
      .set({
        status: RESOURCE_INDEX_RUN_STATUS.Running,
        startedAt: new Date(),
      })
      .where(
        and(
          identifierFilter(dto),
          inArray(runs.status, RESOURCE_INDEX_RUN_ACTIVE_STATUSES)
        )
      )
      .returning();

    return row ?? null;
  }
);

/** Releases the target: the partial unique indexes stop covering the row here. */
export const finalizeResourceIndexRun = withDTO(
  async (
    db,
    dto: ResourceIndexRunIdentifier & {
      status: ResourceIndexRunTerminalStatus;
      result?: unknown;
      error?: string | null;
    }
  ): Promise<ResourceIndexRun | null> => {
    const [row] = await db
      .update(runs)
      .set({
        status: dto.status,
        result: dto.result ?? null,
        error: dto.error ?? null,
        endedAt: new Date(),
      })
      .where(identifierFilter(dto))
      .returning();

    return row ?? null;
  }
);

export const recordResourceIndexRunProgress = withDTO(
  async (
    db,
    dto: { id: number; progress: ResourceIndexRunProgress }
  ): Promise<ResourceIndexRun | null> => {
    const [row] = await db
      .update(runs)
      .set({ progress: dto.progress })
      .where(eq(runs.id, dto.id))
      .returning();

    return row ?? null;
  }
);
