import { and, asc, desc, eq, gt, isNull } from "drizzle-orm";

import type { DB } from "../../index.ts";
import {
  agentRuns,
  agentSessionEntries,
  agentSessions,
  agentToolApprovals,
  writingAgentDrafts,
  writingAgentSessions,
} from "../../schemas/index.ts";
import type { AgentRunStatus, Locale } from "../../schemas/index.ts";

/**
 * Repository for shared agent persistence and kind-owned extensions.
 *
 * Every drizzle query for the agent tables lives here, matching the rest of `packages/db`.
 * Agent packages call these instead of importing `drizzle-orm` themselves — sharing one ORM
 * instance and keeping SQL in the package that owns the schema. Writing-specific queries are
 * explicitly named so another kind can add a sibling extension without changing shared records.
 */

// ============================================
// Sessions
// ============================================

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
  runtimeConfig?: Record<string, unknown>;
  configVersion?: number;
  leafEntryId?: string | null;
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

export interface UpdateAgentSessionDTO {
  title?: string | null;
  providerId?: string | null;
  modelId?: string | null;
  thinkingLevel?: string | null;
  activeToolNames?: string[] | null;
  autoApprove?: string[];
  runtimeConfig?: Record<string, unknown>;
  configVersion?: number;
  leafEntryId?: string | null;
}

/**
 * Only the keys present in `patch` are written.
 *
 * `null` and `undefined` mean different things here: a nullable setting can be cleared with
 * `null`, while omitting the key leaves it alone.
 */
export const updateAgentSession = async (
  db: DB,
  sessionId: string,
  patch: UpdateAgentSessionDTO
) => {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) set[key] = value;
  }
  if (Object.keys(set).length === 0) return;
  await db
    .update(agentSessions)
    .set(set)
    .where(eq(agentSessions.id, sessionId));
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

// ============================================
// Runs
// ============================================

/**
 * Replaces the session's active run in one transaction. The workflow backend only supports one
 * message hook per session, so superseded runs must not remain active in the database.
 */
export const createAgentRun = async (
  db: DB,
  input: {
    id: string;
    sessionId: string;
    harnessKind: string;
    harnessVersion?: number;
    externalRunId: string;
    metadata?: Record<string, unknown>;
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

export const completeActiveAgentRuns = async (
  db: DB,
  sessionId: string,
  status: Exclude<AgentRunStatus, "active">
) => {
  await db
    .update(agentRuns)
    .set({ status, endedAt: new Date() })
    .where(
      and(eq(agentRuns.sessionId, sessionId), eq(agentRuns.status, "active"))
    );
};

// ============================================
// Session entries (the transcript tree)
// ============================================

export interface InsertAgentSessionEntryDTO {
  id: string;
  sessionId: string;
  parentId: string | null;
  type: string;
  payload: Record<string, unknown>;
  timestamp: Date;
}

export const appendAgentSessionEntry = async (
  db: DB,
  input: InsertAgentSessionEntryDTO
) => {
  await db.insert(agentSessionEntries).values(input);
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

export const getAgentSessionEntries = async (
  db: DB,
  sessionId: string,
  options?: { afterSeq?: number; limit?: number }
) => {
  const conditions = [eq(agentSessionEntries.sessionId, sessionId)];
  if (options?.afterSeq !== undefined) {
    conditions.push(gt(agentSessionEntries.seq, options.afterSeq));
  }
  const query = db
    .select()
    .from(agentSessionEntries)
    .where(and(...conditions))
    .orderBy(asc(agentSessionEntries.seq));
  return options?.limit ? await query.limit(options.limit) : await query;
};

// ============================================
// Writing agent state
// ============================================

export const createWritingAgentSession = async (
  db: DB,
  input: {
    sessionId: string;
    targetFeedId?: number | null;
    feedMeta?: Record<string, unknown>;
  }
) => {
  const [row] = await db
    .insert(writingAgentSessions)
    .values({
      sessionId: input.sessionId,
      targetFeedId: input.targetFeedId ?? null,
      feedMeta: input.feedMeta ?? {},
    })
    .returning();
  return row;
};

export const getWritingAgentSession = async (db: DB, sessionId: string) =>
  await db.query.writingAgentSessions.findFirst({
    where: { sessionId },
  });

export const updateWritingAgentSession = async (
  db: DB,
  sessionId: string,
  patch: {
    targetFeedId?: number | null;
    feedMeta?: Record<string, unknown>;
  }
) => {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) set[key] = value;
  }
  if (Object.keys(set).length === 0) return;
  await db
    .update(writingAgentSessions)
    .set(set)
    .where(eq(writingAgentSessions.sessionId, sessionId));
};

export const getWritingAgentDrafts = async (db: DB, sessionId: string) =>
  await db
    .select()
    .from(writingAgentDrafts)
    .where(eq(writingAgentDrafts.sessionId, sessionId));

export const upsertWritingAgentDraft = async (
  db: DB,
  input: {
    sessionId: string;
    locale: Locale;
    meta: Record<string, unknown>;
    /** `undefined` leaves the existing body untouched; `null` clears it. */
    content?: string | null;
  }
) => {
  await db
    .insert(writingAgentDrafts)
    .values({
      sessionId: input.sessionId,
      locale: input.locale,
      meta: input.meta,
      content: input.content ?? null,
    })
    .onConflictDoUpdate({
      target: [writingAgentDrafts.sessionId, writingAgentDrafts.locale],
      set: {
        meta: input.meta,
        ...(input.content === undefined ? {} : { content: input.content }),
      },
    });
};

export const deleteWritingAgentDrafts = async (db: DB, sessionId: string) => {
  await db
    .delete(writingAgentDrafts)
    .where(eq(writingAgentDrafts.sessionId, sessionId));
};

// ============================================
// Tool approvals
// ============================================

export const recordAgentApprovalRequests = async (
  db: DB,
  inputs: readonly {
    sessionId: string;
    toolCallId: string;
    toolName: string;
    args?: Record<string, unknown>;
  }[]
) => {
  if (inputs.length === 0) return;

  await db
    .insert(agentToolApprovals)
    .values(
      inputs.map((input) => ({
        sessionId: input.sessionId,
        toolCallId: input.toolCallId,
        toolName: input.toolName,
        args: input.args ?? null,
      }))
    )
    // The model may re-issue a gated call; the first request wins so an existing decision
    // is never overwritten by a fresh request.
    .onConflictDoNothing({
      target: [agentToolApprovals.sessionId, agentToolApprovals.toolCallId],
    });
};

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
        eq(agentToolApprovals.toolCallId, input.toolCallId)
      )
    )
    .returning();
  return row;
};

/** Tool call ids approved for this session, for seeding the permission gate on resume. */
export const getApprovedAgentToolCallIds = async (
  db: DB,
  sessionId: string
) => {
  const rows = await db
    .select({ toolCallId: agentToolApprovals.toolCallId })
    .from(agentToolApprovals)
    .where(
      and(
        eq(agentToolApprovals.sessionId, sessionId),
        eq(agentToolApprovals.status, "approved")
      )
    );
  return rows.map((row) => row.toolCallId);
};

export const getAgentApprovals = async (db: DB, sessionId: string) =>
  await db
    .select()
    .from(agentToolApprovals)
    .where(eq(agentToolApprovals.sessionId, sessionId))
    .orderBy(asc(agentToolApprovals.createdAt));
