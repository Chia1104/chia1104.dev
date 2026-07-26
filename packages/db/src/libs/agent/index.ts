import { and, asc, desc, eq, gt, isNull } from "drizzle-orm";

import type { DB } from "../../index.ts";
import {
  agentDrafts,
  agentPendingMessages,
  agentSessionEntries,
  agentSessions,
  agentToolApprovals,
} from "../../schemas/index.ts";
import type { Locale } from "../../schemas/index.ts";

/**
 * Repository for the writing agent's persistence.
 *
 * Every drizzle query for the agent tables lives here, matching the rest of `packages/db`.
 * `@chia/agent` calls these instead of importing `drizzle-orm` itself — sharing one ORM
 * instance and keeping SQL in the package that owns the schema.
 */

// ============================================
// Sessions
// ============================================

export interface InsertAgentSessionDTO {
  id: string;
  userId: string;
  kind: string;
  title?: string | null;
  providerId: string;
  modelId: string;
  thinkingLevel: string;
  activeToolNames?: string[] | null;
  autoApprove?: string[];
  targetFeedId?: number | null;
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
      targetFeedId: input.targetFeedId ?? null,
      leafEntryId: input.leafEntryId ?? null,
    })
    .returning();
  return row;
};

export const getAgentSession = async (db: DB, sessionId: string) =>
  await db.query.agentSessions.findFirst({ where: { id: sessionId } });

export const getAgentSessions = async (
  db: DB,
  options: { userId: string; limit?: number; includeDeleted?: boolean }
) =>
  await db
    .select()
    .from(agentSessions)
    .where(
      options.includeDeleted
        ? eq(agentSessions.userId, options.userId)
        : and(
            eq(agentSessions.userId, options.userId),
            isNull(agentSessions.deletedAt)
          )
    )
    .orderBy(desc(agentSessions.updatedAt))
    .limit(options.limit ?? 50);

export interface UpdateAgentSessionDTO {
  title?: string | null;
  providerId?: string;
  modelId?: string;
  thinkingLevel?: string;
  activeToolNames?: string[] | null;
  autoApprove?: string[];
  targetFeedId?: number | null;
  leafEntryId?: string | null;
  feedMeta?: Record<string, unknown> | null;
  workflowRunId?: string | null;
}

/**
 * Only the keys present in `patch` are written.
 *
 * `null` and `undefined` mean different things here: `targetFeedId: null` detaches the
 * session from its post, while omitting the key leaves it alone.
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

/** Hard delete. Entries, drafts, pending messages and approvals cascade. */
export const deleteAgentSession = async (db: DB, sessionId: string) => {
  await db.delete(agentSessions).where(eq(agentSessions.id, sessionId));
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
// Drafts
// ============================================

export const getAgentDrafts = async (db: DB, sessionId: string) =>
  await db
    .select()
    .from(agentDrafts)
    .where(eq(agentDrafts.sessionId, sessionId));

export const upsertAgentDraft = async (
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
    .insert(agentDrafts)
    .values({
      sessionId: input.sessionId,
      locale: input.locale,
      meta: input.meta,
      content: input.content ?? null,
    })
    .onConflictDoUpdate({
      target: [agentDrafts.sessionId, agentDrafts.locale],
      set: {
        meta: input.meta,
        ...(input.content === undefined ? {} : { content: input.content }),
      },
    });
};

export const deleteAgentDrafts = async (db: DB, sessionId: string) => {
  await db.delete(agentDrafts).where(eq(agentDrafts.sessionId, sessionId));
};

// ============================================
// Pending messages
// ============================================

export const pushAgentPendingMessage = async (
  db: DB,
  input: { id: string; sessionId: string; kind: string; text: string }
) => {
  await db.insert(agentPendingMessages).values(input);
};

/**
 * Claims every unconsumed message in one statement.
 *
 * A conditional `UPDATE … RETURNING` is the atomic primitive: a select-then-update pair
 * would let two concurrent drains hand the same message to the harness twice.
 */
export const claimAgentPendingMessages = async (db: DB, sessionId: string) => {
  const rows = await db
    .update(agentPendingMessages)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(agentPendingMessages.sessionId, sessionId),
        isNull(agentPendingMessages.consumedAt)
      )
    )
    .returning({
      id: agentPendingMessages.id,
      kind: agentPendingMessages.kind,
      text: agentPendingMessages.text,
      createdAt: agentPendingMessages.createdAt,
    });
  return rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
};

export const peekAgentPendingMessages = async (db: DB, sessionId: string) =>
  await db
    .select({
      id: agentPendingMessages.id,
      kind: agentPendingMessages.kind,
      text: agentPendingMessages.text,
    })
    .from(agentPendingMessages)
    .where(
      and(
        eq(agentPendingMessages.sessionId, sessionId),
        isNull(agentPendingMessages.consumedAt)
      )
    )
    .orderBy(asc(agentPendingMessages.createdAt));

// ============================================
// Tool approvals
// ============================================

export const recordAgentApprovalRequest = async (
  db: DB,
  input: {
    sessionId: string;
    toolCallId: string;
    toolName: string;
    args?: Record<string, unknown>;
  }
) => {
  await db
    .insert(agentToolApprovals)
    .values({
      sessionId: input.sessionId,
      toolCallId: input.toolCallId,
      toolName: input.toolName,
      args: input.args ?? null,
    })
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
      approved: input.approved ? "true" : "false",
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
        eq(agentToolApprovals.approved, "true")
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
