import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";

import type { DB } from "../../client.ts";
import { agentMemories } from "../../schemas/schema.ts";
import type {
  AgentMemory,
  AgentMemoryKind,
  AgentMemoryStatus,
} from "../../schemas/schema.ts";
import {
  AGENT_MEMORY_KIND,
  AGENT_MEMORY_STATUS,
} from "../../schemas/schema.ts";

/**
 * Repository for `agent.memory`.
 *
 * Soft-deleted rows are invisible to every read here except `getAgentMemory`, which the RAG
 * adapter uses to decide whether a memory still owns chunks — it needs to see the row go.
 */

const live = () => isNull(agentMemories.deletedAt);

/** The population the index carries: live rows that are not archived. */
const indexable = () =>
  and(live(), ne(agentMemories.status, AGENT_MEMORY_STATUS.Archived));

export interface InsertAgentMemoryDTO {
  kind: AgentMemoryKind;
  title: string;
  content: string;
  sourceUrl?: string | null;
  sessionId?: string | null;
  status?: AgentMemoryStatus;
}

export const createAgentMemory = async (
  db: DB,
  input: InsertAgentMemoryDTO
): Promise<AgentMemory> => {
  const [row] = await db
    .insert(agentMemories)
    .values({
      kind: input.kind,
      status: input.status ?? AGENT_MEMORY_STATUS.Active,
      title: input.title,
      content: input.content,
      sourceUrl: input.sourceUrl ?? null,
      sessionId: input.sessionId ?? null,
    })
    .returning();
  if (!row) throw new Error("Memory was not inserted.");
  return row;
};

/** Includes soft-deleted rows; callers that must not see them check `deletedAt`. */
export const getAgentMemory = async (db: DB, id: number) =>
  await db.query.agentMemories.findFirst({ where: { id } });

/** Live rows only, in no particular order — key the result by id. */
export const getAgentMemories = async (
  db: DB,
  ids: readonly number[]
): Promise<AgentMemory[]> => {
  if (ids.length === 0) return [];
  return await db
    .select()
    .from(agentMemories)
    .where(and(inArray(agentMemories.id, [...ids]), live()));
};

export interface UpdateAgentMemoryDTO {
  title?: string;
  content?: string;
  status?: AgentMemoryStatus;
  sourceUrl?: string | null;
}

/** Only the keys present in `patch` are written; returns the live row, or undefined. */
export const updateAgentMemory = async (
  db: DB,
  id: number,
  patch: UpdateAgentMemoryDTO
): Promise<AgentMemory | undefined> => {
  const set: UpdateAgentMemoryDTO = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) Object.assign(set, { [key]: value });
  }
  if (Object.keys(set).length === 0) {
    return await db.query.agentMemories.findFirst({
      where: { id, deletedAt: { isNull: true } },
    });
  }
  const [row] = await db
    .update(agentMemories)
    .set(set)
    .where(and(eq(agentMemories.id, id), live()))
    .returning();
  return row;
};

export const softDeleteAgentMemory = async (
  db: DB,
  id: number
): Promise<boolean> => {
  const rows = await db
    .update(agentMemories)
    .set({ deletedAt: new Date() })
    .where(and(eq(agentMemories.id, id), live()))
    .returning({ id: agentMemories.id });
  return rows.length > 0;
};

export interface UpsertSourceMemoryDTO {
  sourceUrl: string;
  title: string;
  content: string;
  sessionId?: string | null;
}

/**
 * Records a page the agent read, keyed on its URL.
 *
 * `ON CONFLICT` names the same predicate as the partial unique index
 * (`agent_memory_source_url_idx`), which is what lets Postgres pick it as the arbiter. A
 * revisit refreshes title and content but keeps the first session as provenance.
 *
 * `changed` is read before the write rather than inside it: two parallel fetches of one URL
 * can both see no row and both report `changed`, which costs one redundant index run and
 * nothing else — the alternative is a data-modifying CTE for a race that indexes idempotently.
 */
export const upsertSourceMemory = async (
  db: DB,
  input: UpsertSourceMemoryDTO
): Promise<{ id: number; changed: boolean }> => {
  const [existing] = await db
    .select({ title: agentMemories.title, content: agentMemories.content })
    .from(agentMemories)
    .where(
      and(
        eq(agentMemories.sourceUrl, input.sourceUrl),
        eq(agentMemories.kind, AGENT_MEMORY_KIND.Source),
        live()
      )
    )
    .limit(1);

  const [row] = await db
    .insert(agentMemories)
    .values({
      kind: AGENT_MEMORY_KIND.Source,
      title: input.title,
      content: input.content,
      sourceUrl: input.sourceUrl,
      sessionId: input.sessionId ?? null,
    })
    .onConflictDoUpdate({
      target: agentMemories.sourceUrl,
      targetWhere: sql`${agentMemories.kind} = '${sql.raw(AGENT_MEMORY_KIND.Source)}' and ${agentMemories.deletedAt} is null`,
      set: {
        title: input.title,
        content: input.content,
        updatedAt: new Date(),
      },
    })
    .returning({ id: agentMemories.id });
  if (!row) throw new Error("Source memory was not upserted.");

  return {
    id: row.id,
    changed:
      !existing ||
      existing.title !== input.title ||
      existing.content !== input.content,
  };
};

export interface AgentMemorySummary {
  id: number;
  kind: AgentMemoryKind;
  status: AgentMemoryStatus;
  title: string;
  sourceUrl: string | null;
}

const summaryColumns = {
  id: agentMemories.id,
  kind: agentMemories.kind,
  status: agentMemories.status,
  title: agentMemories.title,
  sourceUrl: agentMemories.sourceUrl,
};

/** What a session has written so far, oldest first — for the volatile context. */
export const listAgentMemoriesBySession = async (
  db: DB,
  sessionId: string
): Promise<AgentMemorySummary[]> =>
  await db
    .select(summaryColumns)
    .from(agentMemories)
    .where(and(eq(agentMemories.sessionId, sessionId), live()))
    .orderBy(asc(agentMemories.id));

/** Active lessons, most recently touched first — the operator archives to make room. */
export const listActiveAgentLessons = async (
  db: DB,
  limit: number
): Promise<AgentMemorySummary[]> =>
  await db
    .select(summaryColumns)
    .from(agentMemories)
    .where(
      and(
        eq(agentMemories.kind, AGENT_MEMORY_KIND.Lesson),
        eq(agentMemories.status, AGENT_MEMORY_STATUS.Active),
        live()
      )
    )
    .orderBy(desc(agentMemories.updatedAt), desc(agentMemories.id))
    .limit(limit);

/** Every memory a full reindex walks. */
export const listAgentMemoryIds = async (db: DB): Promise<number[]> => {
  const rows = await db
    .select({ id: agentMemories.id })
    .from(agentMemories)
    .where(indexable())
    .orderBy(asc(agentMemories.id));
  return rows.map((row) => row.id);
};

/** The same population as {@link listAgentMemoryIds}, for the reindex preview. */
export const countAgentMemories = async (db: DB): Promise<number> => {
  const [row] = await db
    .select({ count: sql<number>`(count(*))::int` })
    .from(agentMemories)
    .where(indexable());
  return row?.count ?? 0;
};

export interface AgentMemoryListItem extends AgentMemorySummary {
  sessionId: string | null;
  /** Truncated `content`; the full text is a `getAgentMemory` away. */
  preview: string;
  createdAt: Date;
  updatedAt: Date;
}

const PREVIEW_LENGTH = 160;
const LIST_LIMIT_MAX = 100;

/**
 * The dashboard's list: newest first, cursor on the id. `query` is a substring match, a
 * list filter rather than retrieval — the ranked search is the agent's `search_memory`.
 */
export const listAgentMemories = async (
  db: DB,
  dto: {
    kind?: AgentMemoryKind;
    status?: AgentMemoryStatus;
    query?: string;
    /** Inclusive id the page starts at. */
    cursor?: number | null;
    limit?: number;
  }
): Promise<{ items: AgentMemoryListItem[]; nextCursor: number | null }> => {
  const limit = Math.min(Math.max(dto.limit ?? 50, 1), LIST_LIMIT_MAX);
  const query = dto.query?.trim();

  const rows = await db
    .select({
      ...summaryColumns,
      sessionId: agentMemories.sessionId,
      preview: sql<string>`left(${agentMemories.content}, ${PREVIEW_LENGTH})`,
      createdAt: agentMemories.createdAt,
      updatedAt: agentMemories.updatedAt,
    })
    .from(agentMemories)
    .where(
      and(
        live(),
        dto.kind ? eq(agentMemories.kind, dto.kind) : undefined,
        dto.status ? eq(agentMemories.status, dto.status) : undefined,
        query
          ? or(
              ilike(agentMemories.title, `%${query}%`),
              ilike(agentMemories.content, `%${query}%`)
            )
          : undefined,
        dto.cursor == null
          ? undefined
          : sql`${agentMemories.id} <= ${dto.cursor}`
      )
    )
    .orderBy(desc(agentMemories.id))
    .limit(limit + 1);

  // the cursor is inclusive, so the extra row is where the next page starts
  return {
    items: rows.slice(0, limit),
    nextCursor: rows.length > limit ? (rows[limit]?.id ?? null) : null,
  };
};
