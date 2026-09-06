import { and, asc, count, desc, eq, isNull, max, sql } from "drizzle-orm";

import type { JsonObject } from "@chia/utils/json";

import type { DB } from "../../client.ts";
import {
  agentRuns,
  agentSessionEntries,
  agentSessions,
  agentToolApprovals,
  agentUsageLedger,
  writingAgentSessionDrafts,
  writingAgentSessions,
} from "../../schemas/schema.ts";
import type { AgentRunStatus } from "../../schemas/schema.ts";

export interface InsertAgentSessionDTO {
  id: string;
  userId: string;
  kind: string;
  title?: string | null;
  providerId?: string | null;
  modelId?: string | null;
  thinkingLevel?: string | null;
  activeToolNames?: string[] | null;
  autoApprove?: string[];
  runtimeConfig?: JsonObject;
  configVersion?: number;
  leafEntryId?: string | null;
  forkedFromSessionId?: string | null;
  forkedFromEntryId?: string | null;
}

export const createAgentSession = async (
  db: DB,
  input: InsertAgentSessionDTO
) => {
  const [row] = await db
    .insert(agentSessions)
    .values({
      id: input.id,
      userId: input.userId,
      kind: input.kind,
      title: input.title ?? null,
      providerId: input.providerId,
      modelId: input.modelId,
      thinkingLevel: input.thinkingLevel,
      activeToolNames: input.activeToolNames ?? null,
      autoApprove: input.autoApprove ?? [],
      runtimeConfig: input.runtimeConfig ?? {},
      configVersion: input.configVersion ?? 1,
      leafEntryId: input.leafEntryId ?? null,
      forkedFromSessionId: input.forkedFromSessionId ?? null,
      forkedFromEntryId: input.forkedFromEntryId ?? null,
    })
    .returning();
  return row;
};

export const getAgentSession = async (db: DB, sessionId: string) =>
  await db.query.agentSessions.findFirst({ where: { id: sessionId } });

export const getAgentSessions = async (
  db: DB,
  options: {
    userId: string;
    kind?: string;
    limit?: number;
    includeDeleted?: boolean;
  }
) => {
  const conditions = [eq(agentSessions.userId, options.userId)];
  if (options.kind) conditions.push(eq(agentSessions.kind, options.kind));
  if (!options.includeDeleted) conditions.push(isNull(agentSessions.deletedAt));

  return await db
    .select()
    .from(agentSessions)
    .where(and(...conditions))
    .orderBy(desc(agentSessions.updatedAt))
    .limit(options.limit ?? 50);
};

/** Sessions a user still has, deleted ones excluded. */
export const countAgentSessions = async (
  db: DB,
  options: { userId: string }
): Promise<number> => {
  const [row] = await db
    .select({ total: count() })
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.userId, options.userId),
        isNull(agentSessions.deletedAt)
      )
    );
  return row?.total ?? 0;
};

export interface UpdateAgentSessionDTO {
  title?: string | null;
  providerId?: string | null;
  modelId?: string | null;
  thinkingLevel?: string | null;
  activeToolNames?: string[] | null;
  autoApprove?: string[];
  runtimeConfig?: JsonObject;
  configVersion?: number;
  leafEntryId?: string | null;
}

/** Only keys present in `patch` are written. `null` clears a nullable setting; omitting the key leaves it. */
export const updateAgentSession = async (
  db: DB,
  sessionId: string,
  patch: UpdateAgentSessionDTO
) => {
  const set: Partial<UpdateAgentSessionDTO> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) Object.assign(set, { [key]: value });
  }
  if (Object.keys(set).length === 0) return;
  await db
    .update(agentSessions)
    .set(set)
    .where(eq(agentSessions.id, sessionId));
};

/** Writes a generated title only while the session still has none, so a concurrent rename wins. Returns whether it landed. */
export const setAgentSessionTitleIfUnset = async (
  db: DB,
  sessionId: string,
  title: string
): Promise<boolean> => {
  const rows = await db
    .update(agentSessions)
    .set({ title })
    .where(and(eq(agentSessions.id, sessionId), isNull(agentSessions.title)))
    .returning({ id: agentSessions.id });
  return rows.length > 0;
};

export const softDeleteAgentSession = async (db: DB, sessionId: string) => {
  await db
    .update(agentSessions)
    .set({ deletedAt: new Date() })
    .where(eq(agentSessions.id, sessionId));
};

export const restoreAgentSession = async (db: DB, sessionId: string) => {
  await db
    .update(agentSessions)
    .set({ deletedAt: null })
    .where(eq(agentSessions.id, sessionId));
};

/** Hard delete. Runs, entries, kind extensions and approvals cascade. */
export const deleteAgentSession = async (db: DB, sessionId: string) => {
  await db.delete(agentSessions).where(eq(agentSessions.id, sessionId));
};

/** Moves a guest's sessions, ledger and approvals onto `toUserId` in one transaction so signing in does not reset quota. */
export const transferAgentOwnership = async (
  db: DB,
  options: { fromUserId: string; toUserId: string }
): Promise<void> => {
  await db.transaction(async (tx) => {
    await tx
      .update(agentSessions)
      .set({ userId: options.toUserId })
      .where(eq(agentSessions.userId, options.fromUserId));
    await tx
      .update(agentUsageLedger)
      .set({ userId: options.toUserId })
      .where(eq(agentUsageLedger.userId, options.fromUserId));
    await tx
      .update(agentToolApprovals)
      .set({ decidedBy: options.toUserId })
      .where(eq(agentToolApprovals.decidedBy, options.fromUserId));
  });
};

/** Replaces the session's active run in one transaction: a session drives one run at a time. */
export const createAgentRun = async (
  db: DB,
  input: {
    id: string;
    sessionId: string;
    harnessKind: string;
    harnessVersion?: number;
    externalRunId: string;
    metadata?: JsonObject;
  }
) =>
  await db.transaction(async (tx) => {
    await tx
      .update(agentRuns)
      .set({ status: "completed", endedAt: new Date() })
      .where(
        and(
          eq(agentRuns.sessionId, input.sessionId),
          eq(agentRuns.status, "active")
        )
      );

    const [row] = await tx
      .insert(agentRuns)
      .values({
        ...input,
        harnessVersion: input.harnessVersion ?? 1,
        metadata: input.metadata ?? {},
      })
      .returning();
    return row;
  });

export const getActiveAgentRun = async (db: DB, sessionId: string) =>
  await db.query.agentRuns.findFirst({
    where: { sessionId, status: "active" },
    orderBy: { startedAt: "desc" },
  });

/** Shallow-merges `patch` into `metadata`, addressed by the row's own id so a cancelled run cannot touch its replacement. */
export const patchAgentRunMetadata = async (
  db: DB,
  runId: string,
  patch: JsonObject
) => {
  await db
    .update(agentRuns)
    .set({
      metadata: sql`${agentRuns.metadata} || ${JSON.stringify(patch)}::jsonb`,
    })
    .where(eq(agentRuns.id, runId));
};

/**
 * The executor's claim on a turn: under the session lock, the run must still be the active
 * one, then its workflow run id is bound and the marker written in one transaction. `false`
 * means the run was cancelled, failed or replaced since it was started, and the step must not
 * execute anything.
 */
export const claimAgentRunTurn = async (
  db: DB,
  input: {
    sessionId: string;
    runId: string;
    externalRunId: string;
    turnKey: string;
    marker: JsonObject;
  }
): Promise<boolean> =>
  withAgentSessionLock(db, input.sessionId, async (tx) => {
    const [run] = await tx
      .select({ status: agentRuns.status })
      .from(agentRuns)
      .where(
        and(
          eq(agentRuns.id, input.runId),
          eq(agentRuns.sessionId, input.sessionId)
        )
      )
      .for("update");
    if (run?.status !== "active") return false;
    await tx
      .update(agentRuns)
      .set({
        externalRunId: input.externalRunId,
        metadata: sql`${agentRuns.metadata} || ${JSON.stringify({ [input.turnKey]: input.marker })}::jsonb`,
      })
      .where(eq(agentRuns.id, input.runId));
    return true;
  });

/** Points a run row written ahead of its workflow at the run the workflow backend then created. */
export const bindAgentRunExternalId = async (
  db: DB,
  runId: string,
  externalRunId: string
) => {
  await db
    .update(agentRuns)
    .set({ externalRunId })
    .where(eq(agentRuns.id, runId));
};

/**
 * Runs `fn` under the session's advisory lock so turn enqueue and tree maintenance never interleave.
 * `fn` must use the handed `tx` only; a second connection would deadlock under load.
 */
export const withAgentSessionLock = <T>(
  db: DB,
  sessionId: string,
  fn: (tx: DB) => Promise<T>
): Promise<T> =>
  db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`agent.session:${sessionId}`}))`
    );
    return await fn(tx);
  });

/**
 * Takes the user's advisory lock on this transaction so two sessions cannot both pass a per-user check.
 * Always after the session lock, and only inside `withAgentSessionLock`'s `tx`.
 */
export const lockAgentUser = async (tx: DB, userId: string): Promise<void> => {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`agent.user:${userId}`}))`
  );
};

/** Active runs of the user's sessions whose turn marker (`metadata[turnKey].running`) is set. */
const runningTurnsOf = (options: { userId: string; turnKey: string }) =>
  and(
    eq(agentSessions.userId, options.userId),
    eq(agentRuns.status, "active"),
    sql`${agentRuns.metadata} -> ${options.turnKey} ->> 'running' = 'true'`
  );

/**
 * Turns whose `metadata[turnKey].running` marker is set. A run parked on its message hook does not count.
 * A dead step can leave the marker set; callers that must not over-count reconcile against the World first.
 */
export const countRunningAgentTurns = async (
  db: DB,
  options: { userId: string; turnKey: string }
): Promise<number> => {
  const [row] = await db
    .select({ running: count() })
    .from(agentRuns)
    .innerJoin(agentSessions, eq(agentSessions.id, agentRuns.sessionId))
    .where(runningTurnsOf(options));
  return row?.running ?? 0;
};

/** The rows `countRunningAgentTurns` counts, for a reader that checks each against the World. */
export const listRunningAgentRuns = async (
  db: DB,
  options: { userId: string; turnKey: string }
) =>
  await db
    .select({ run: agentRuns })
    .from(agentRuns)
    .innerJoin(agentSessions, eq(agentSessions.id, agentRuns.sessionId))
    .where(runningTurnsOf(options))
    .then((rows) => rows.map((row) => row.run));

export const completeAgentRun = async (
  db: DB,
  runId: string,
  status: Exclude<AgentRunStatus, "active">
) => {
  await db
    .update(agentRuns)
    .set({ status, endedAt: new Date() })
    .where(eq(agentRuns.id, runId));
};

/**
 * Closes an active run only while it still carries `externalRunId`, the value a reader based
 * its verdict on. A lease the executor bound meanwhile no longer matches, so the run it now
 * drives is left alone. Returns whether the row was closed.
 */
export const completeAgentRunIfUnbound = async (
  db: DB,
  runId: string,
  externalRunId: string,
  status: Exclude<AgentRunStatus, "active">
): Promise<boolean> => {
  const rows = await db
    .update(agentRuns)
    .set({ status, endedAt: new Date() })
    .where(
      and(
        eq(agentRuns.id, runId),
        eq(agentRuns.externalRunId, externalRunId),
        eq(agentRuns.status, "active")
      )
    )
    .returning({ id: agentRuns.id });
  return rows.length > 0;
};

export interface InsertAgentSessionEntryDTO {
  id: string;
  sessionId: string;
  parentId: string | null;
  type: string;
  payload: JsonObject;
  timestamp: Date;
}

/** Appends an entry and sets it as the leaf in one transaction so a failure cannot leave an entry off every branch. */
export const appendAgentSessionEntryAsLeaf = async (
  db: DB,
  input: InsertAgentSessionEntryDTO
): Promise<{ seq: number }> =>
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(agentSessionEntries)
      .values(input)
      .returning({ seq: agentSessionEntries.seq });
    if (!row) throw new Error(`Entry ${input.id} was not inserted.`);
    await tx
      .update(agentSessions)
      .set({ leafEntryId: input.id })
      .where(eq(agentSessions.id, input.sessionId));
    return row;
  });

/** Newest `seq` on any branch; `0` if none. `max()` keeps the column's full `bigserial` range. */
export const getAgentSessionLastSeq = async (
  db: DB,
  sessionId: string
): Promise<number> => {
  const [row] = await db
    .select({ seq: max(agentSessionEntries.seq) })
    .from(agentSessionEntries)
    .where(eq(agentSessionEntries.sessionId, sessionId));
  return row?.seq ?? 0;
};

export const getAgentSessionEntry = async (
  db: DB,
  sessionId: string,
  entryId: string
) => {
  const [row] = await db
    .select()
    .from(agentSessionEntries)
    .where(
      and(
        eq(agentSessionEntries.sessionId, sessionId),
        eq(agentSessionEntries.id, entryId)
      )
    )
    .limit(1);
  return row;
};

export const getAgentSessionEntriesByType = async (
  db: DB,
  sessionId: string,
  type: string
) =>
  await db
    .select()
    .from(agentSessionEntries)
    .where(
      and(
        eq(agentSessionEntries.sessionId, sessionId),
        eq(agentSessionEntries.type, type)
      )
    )
    .orderBy(asc(agentSessionEntries.seq));

/** Every entry, all branches, in `seq` order. */
export const getAgentSessionEntries = async (db: DB, sessionId: string) =>
  await db
    .select()
    .from(agentSessionEntries)
    .where(eq(agentSessionEntries.sessionId, sessionId))
    .orderBy(asc(agentSessionEntries.seq));

export const createWritingAgentSession = async (
  db: DB,
  input: { sessionId: string }
) => {
  const [row] = await db
    .insert(writingAgentSessions)
    .values({ sessionId: input.sessionId })
    .returning();
  return row;
};

export interface WritingAgentSessionDraftState {
  draftId: number;
  lastSeenRevision: number;
  touchedAt: Date;
}

export interface WritingAgentSessionState {
  sessionId: string;
  /** Drafts the session has worked on, most recently touched first. */
  drafts: WritingAgentSessionDraftState[];
}

export const getWritingAgentSession = async (
  db: DB,
  sessionId: string
): Promise<WritingAgentSessionState | null> => {
  const [row] = await db
    .select({ sessionId: writingAgentSessions.sessionId })
    .from(writingAgentSessions)
    .where(eq(writingAgentSessions.sessionId, sessionId));
  if (!row) return null;
  const drafts = await db
    .select({
      draftId: writingAgentSessionDrafts.draftId,
      lastSeenRevision: writingAgentSessionDrafts.lastSeenRevision,
      touchedAt: writingAgentSessionDrafts.touchedAt,
    })
    .from(writingAgentSessionDrafts)
    .where(eq(writingAgentSessionDrafts.sessionId, sessionId))
    .orderBy(desc(writingAgentSessionDrafts.touchedAt));
  return { sessionId: row.sessionId, drafts };
};

/**
 * Records that the session worked on these drafts now. `lastSeenRevision` only moves up: a
 * turn that read an older revision than one already recorded must not hide operator edits.
 */
export const touchWritingSessionDrafts = async (
  db: DB,
  sessionId: string,
  entries: readonly { draftId: number; lastSeenRevision?: number }[]
) => {
  if (entries.length === 0) return;
  const touchedAt = new Date();
  await db
    .insert(writingAgentSessionDrafts)
    .values(
      entries.map((entry) => ({
        sessionId,
        draftId: entry.draftId,
        lastSeenRevision: entry.lastSeenRevision ?? 0,
        touchedAt,
      }))
    )
    .onConflictDoUpdate({
      target: [
        writingAgentSessionDrafts.sessionId,
        writingAgentSessionDrafts.draftId,
      ],
      set: {
        lastSeenRevision: sql`greatest(${writingAgentSessionDrafts.lastSeenRevision}, excluded.last_seen_revision)`,
        touchedAt,
      },
    });
};

/** A fork keeps working on the source session's drafts, from the same revisions. */
export const copyWritingSessionDrafts = async (
  db: DB,
  sourceSessionId: string,
  sessionId: string
) => {
  const rows = await db
    .select({
      draftId: writingAgentSessionDrafts.draftId,
      lastSeenRevision: writingAgentSessionDrafts.lastSeenRevision,
      touchedAt: writingAgentSessionDrafts.touchedAt,
    })
    .from(writingAgentSessionDrafts)
    .where(eq(writingAgentSessionDrafts.sessionId, sourceSessionId));
  if (rows.length === 0) return;
  await db
    .insert(writingAgentSessionDrafts)
    .values(rows.map((row) => ({ ...row, sessionId })))
    .onConflictDoNothing();
};

export const recordAgentApprovalRequest = async (
  db: DB,
  input: {
    sessionId: string;
    toolCallId: string;
    toolName: string;
    approvalKey: string;
    args?: JsonObject;
  }
) => {
  await db
    .insert(agentToolApprovals)
    .values({
      sessionId: input.sessionId,
      toolCallId: input.toolCallId,
      toolName: input.toolName,
      approvalKey: input.approvalKey,
      args: input.args ?? null,
    })
    // First request wins; a re-issued gated call must not overwrite an existing decision.
    .onConflictDoNothing({
      target: [agentToolApprovals.sessionId, agentToolApprovals.toolCallId],
    });
};

export const getAgentApproval = async (
  db: DB,
  sessionId: string,
  toolCallId: string
) =>
  await db.query.agentToolApprovals.findFirst({
    where: { sessionId, toolCallId },
  });

/** Records the decision on a pending request. `undefined` when there is none: a decision is never rewritten. */
export const decideAgentApproval = async (
  db: DB,
  input: {
    sessionId: string;
    toolCallId: string;
    approved: boolean;
    comment?: string;
    decidedBy?: string;
  }
) => {
  const [row] = await db
    .update(agentToolApprovals)
    .set({
      status: input.approved ? "approved" : "rejected",
      comment: input.comment ?? null,
      decidedBy: input.decidedBy ?? null,
      decidedAt: new Date(),
    })
    .where(
      and(
        eq(agentToolApprovals.sessionId, input.sessionId),
        eq(agentToolApprovals.toolCallId, input.toolCallId),
        eq(agentToolApprovals.status, "pending")
      )
    )
    .returning();
  return row;
};

/** Names the run that relays a decision; written in the transaction that records the decision. */
export const setAgentApprovalRelayRun = async (
  db: DB,
  input: { sessionId: string; toolCallId: string; relayRunId: string }
) => {
  await db
    .update(agentToolApprovals)
    .set({ relayRunId: input.relayRunId })
    .where(
      and(
        eq(agentToolApprovals.sessionId, input.sessionId),
        eq(agentToolApprovals.toolCallId, input.toolCallId)
      )
    );
};

export const getAgentRun = async (db: DB, runId: string) =>
  await db.query.agentRuns.findFirst({ where: { id: runId } });

/** Approval keys granted on this session that no call has spent; seeds the permission gate. */
export const listUnspentAgentApprovalKeys = async (
  db: DB,
  sessionId: string
) => {
  const rows = await db
    .select({ approvalKey: agentToolApprovals.approvalKey })
    .from(agentToolApprovals)
    .where(
      and(
        eq(agentToolApprovals.sessionId, sessionId),
        eq(agentToolApprovals.status, "approved"),
        isNull(agentToolApprovals.consumedAt)
      )
    );
  return rows.map((row) => row.approvalKey);
};

/** Spends every unspent approval for `approvalKey`; throws when there is none, so the call stays blocked. */
export const consumeAgentApproval = async (
  db: DB,
  sessionId: string,
  approvalKey: string
) => {
  const rows = await db
    .update(agentToolApprovals)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(agentToolApprovals.sessionId, sessionId),
        eq(agentToolApprovals.approvalKey, approvalKey),
        eq(agentToolApprovals.status, "approved"),
        isNull(agentToolApprovals.consumedAt)
      )
    )
    .returning({ toolCallId: agentToolApprovals.toolCallId });
  if (rows.length === 0) {
    throw new Error(
      `No unspent approval for "${approvalKey}" on agent session ${sessionId}.`
    );
  }
};

export const getAgentApprovals = async (db: DB, sessionId: string) =>
  await db
    .select()
    .from(agentToolApprovals)
    .where(eq(agentToolApprovals.sessionId, sessionId))
    .orderBy(asc(agentToolApprovals.createdAt));
