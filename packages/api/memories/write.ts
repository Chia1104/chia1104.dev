import type { DB } from "@chia/db/client";
import {
  approveAgentLesson,
  createAgentMemory,
  getAgentMemory,
  reinforceAgentMemory,
  softDeleteAgentMemory,
  updateAgentMemory,
  upsertSourceMemory,
} from "@chia/db/repos/agent/memory";
import { isResourceIndexedSince } from "@chia/db/repos/resources/chunk";
import type { AgentMemory } from "@chia/db/schema";
import { AGENT_MEMORY_KIND, AGENT_MEMORY_STATUS } from "@chia/db/schema";
import type { AgentMemoryKind, AgentMemoryStatus } from "@chia/db/schema";
import { AppError } from "@chia/service-kit/errors";

import type { MemoryHooks } from "../orpc/utils";
import { AGENT_MEMORY_SOURCE_TYPE } from "../resources/agent-memory.resource";

/**
 * Shared by oRPC (a request, behind `adminGuard`) and the writing agent's turn (a
 * workflow step, no request). Authorisation happened at the transport boundary.
 * `hooks` is required: a write that skips `onMemoryChanged` leaves the memory
 * unindexed — or, for a removal, still indexed.
 */

/**
 * A `source` holds the whole fetched page, bounded (`SOURCE_MAX_CHARS` in the fetch tool);
 * a fact written by the tool is capped at 4k. The dashboard edits within the same bound.
 */
export const MEMORY_CONTENT_MAX_CHARS = 64_000;
export const MEMORY_TITLE_MAX_CHARS = 200;

const assertTitle = (title: string): string => {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new AppError("BAD_REQUEST", { message: "A memory needs a title." });
  }
  if (trimmed.length > MEMORY_TITLE_MAX_CHARS) {
    throw new AppError("BAD_REQUEST", {
      message: `A memory title is at most ${MEMORY_TITLE_MAX_CHARS} characters.`,
    });
  }
  return trimmed;
};

const assertContent = (content: string): string => {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new AppError("BAD_REQUEST", { message: "A memory needs content." });
  }
  if (trimmed.length > MEMORY_CONTENT_MAX_CHARS) {
    throw new AppError("BAD_REQUEST", {
      message: `Memory content is at most ${MEMORY_CONTENT_MAX_CHARS} characters.`,
    });
  }
  return trimmed;
};

/** Only web URLs are stored; a fragment never identifies a different page. */
export const normalizeSourceUrl = (input: string): string => {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new AppError("BAD_REQUEST", {
      message: `"${input}" is not an absolute URL.`,
    });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError("BAD_REQUEST", {
      message: "A source URL must be http or https.",
    });
  }
  url.hash = "";
  return url.toString();
};

export interface CreateMemoryServiceInput {
  kind: AgentMemoryKind;
  title: string;
  content: string;
  sourceUrl?: string | null;
  sessionId?: string | null;
  status?: AgentMemoryStatus;
  /** A lesson only: the active lesson this one replaces when approved. */
  supersedesId?: number | null;
}

/** Only a live active lesson can be superseded; the id comes from the model. */
const assertSupersedable = async (db: DB, id: number): Promise<number> => {
  const target = await getAgentMemory(db, id);
  if (
    !target ||
    target.deletedAt !== null ||
    target.kind !== AGENT_MEMORY_KIND.Lesson ||
    target.status !== AGENT_MEMORY_STATUS.Active
  ) {
    throw new AppError("BAD_REQUEST", {
      message: `Memory ${id} is not an active lesson, so nothing can supersede it.`,
    });
  }
  return id;
};

export const createMemoryService = async (
  db: DB,
  input: CreateMemoryServiceInput,
  hooks: MemoryHooks
): Promise<AgentMemory> => {
  // activation and the archive of the superseded lesson happen together, in approval only
  if (
    input.supersedesId != null &&
    (input.kind !== AGENT_MEMORY_KIND.Lesson ||
      input.status !== AGENT_MEMORY_STATUS.Pending)
  ) {
    throw new AppError("BAD_REQUEST", {
      message: "Only a pending lesson supersedes another.",
    });
  }
  const row = await createAgentMemory(db, {
    kind: input.kind,
    status: input.status,
    title: assertTitle(input.title),
    content: assertContent(input.content),
    sourceUrl: input.sourceUrl ? normalizeSourceUrl(input.sourceUrl) : null,
    sessionId: input.sessionId ?? null,
    supersedesId:
      input.supersedesId == null
        ? null
        : await assertSupersedable(db, input.supersedesId),
  });

  await hooks.onMemoryChanged?.(row.id);

  return row;
};

/**
 * `pending → active`. A lesson that supersedes another archives that one in the same
 * transaction, so the two never stand side by side in a prompt; both are indexed after it
 * commits.
 */
export const approveLessonService = async (
  db: DB,
  input: { id: number },
  hooks: MemoryHooks
): Promise<AgentMemory> => {
  const row = await getAgentMemory(db, input.id);
  if (!row || row.deletedAt !== null) {
    throw new AppError("NOT_FOUND", {
      message: `Memory ${input.id} not found`,
    });
  }
  if (row.kind !== AGENT_MEMORY_KIND.Lesson) {
    throw new AppError("BAD_REQUEST", {
      message: `Memory ${input.id} is a ${row.kind}, not a lesson.`,
    });
  }
  if (row.status !== AGENT_MEMORY_STATUS.Pending) {
    throw new AppError("BAD_REQUEST", {
      message: `Lesson ${input.id} is ${row.status}; only a pending lesson is approved.`,
    });
  }
  const result = await approveAgentLesson(db, row.id);
  if (result.status === "not_pending") {
    throw new AppError("CONFLICT", {
      message: `Lesson ${input.id} was reviewed by someone else first.`,
    });
  }
  if (result.status === "already_replaced") {
    throw new AppError("CONFLICT", {
      message: `Lesson ${input.id} revises #${row.supersedesId}, which lesson #${result.by} already replaced. Archive one of the two.`,
    });
  }
  if (result.archived) await hooks.onMemoryChanged?.(result.archived.id);
  await hooks.onMemoryChanged?.(result.approved.id);
  return result.approved;
};

/**
 * One more session behind a pending lesson. Nothing to index: a pending lesson has no chunks.
 * False when the id is not a live pending lesson.
 */
export const reinforceLessonService = async (
  db: DB,
  input: { id: number }
): Promise<boolean> => (await reinforceAgentMemory(db, input.id)) !== undefined;

export interface RecordSourceMemoryServiceInput {
  sourceUrl: string;
  title: string;
  content: string;
  sessionId?: string | null;
}

/**
 * The `fetch_url` trail: one row per page, rewritten when the page changed. The index run
 * is scheduled when the text changed, and also whenever the index is older than the row:
 * the row lands before the hook runs, so a hook that failed once would otherwise leave
 * stale or missing chunks until the text happened to change again.
 */
export const recordSourceMemoryService = async (
  db: DB,
  input: RecordSourceMemoryServiceInput,
  hooks: MemoryHooks
): Promise<{ id: number; changed: boolean }> => {
  const result = await upsertSourceMemory(db, {
    sourceUrl: normalizeSourceUrl(input.sourceUrl),
    title: assertTitle(input.title),
    content: assertContent(input.content),
    sessionId: input.sessionId ?? null,
  });

  if (
    result.changed ||
    !(await isResourceIndexedSince(db, {
      ref: { sourceType: AGENT_MEMORY_SOURCE_TYPE, sourceId: result.id },
      since: result.updatedAt,
    }))
  ) {
    await hooks.onMemoryChanged?.(result.id);
  }

  return { id: result.id, changed: result.changed };
};

export interface UpdateMemoryServiceInput {
  id: number;
  title?: string;
  content?: string;
  status?: AgentMemoryStatus;
  sourceUrl?: string | null;
}

export const updateMemoryService = async (
  db: DB,
  input: UpdateMemoryServiceInput,
  hooks: MemoryHooks
): Promise<AgentMemory> => {
  const row = await updateAgentMemory(db, input.id, {
    title: input.title === undefined ? undefined : assertTitle(input.title),
    content:
      input.content === undefined ? undefined : assertContent(input.content),
    status: input.status,
    sourceUrl:
      input.sourceUrl === undefined
        ? undefined
        : input.sourceUrl === null
          ? null
          : normalizeSourceUrl(input.sourceUrl),
  });

  if (!row) {
    throw new AppError("NOT_FOUND", {
      message: `Memory ${input.id} not found`,
    });
  }

  // status alone matters too: an archived memory must leave the index
  await hooks.onMemoryChanged?.(row.id);

  return row;
};

/** Soft delete. The index run that follows finds no live row and clears the chunks. */
export const removeMemoryService = async (
  db: DB,
  input: { id: number },
  hooks: MemoryHooks
): Promise<void> => {
  const removed = await softDeleteAgentMemory(db, input.id);
  if (!removed) {
    throw new AppError("NOT_FOUND", {
      message: `Memory ${input.id} not found`,
    });
  }

  await hooks.onMemoryChanged?.(input.id);
};
