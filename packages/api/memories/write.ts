import type { DB } from "@chia/db/client";
import {
  createAgentMemory,
  softDeleteAgentMemory,
  updateAgentMemory,
  upsertSourceMemory,
} from "@chia/db/repos/agent/memory";
import type { AgentMemory } from "@chia/db/schema";
import type { AgentMemoryKind, AgentMemoryStatus } from "@chia/db/schema";
import { AppError } from "@chia/service-kit/errors";

import type { MemoryHooks } from "../orpc/utils";

/**
 * Memory writes, shared by the oRPC procedures (a request, behind `adminGuard`) and the
 * writing agent's turn (a workflow step, no request at all). Authorisation happened at the
 * transport boundary before either caller reached here.
 *
 * `hooks` is a required argument for the same reason as in `feeds/write.ts`: a write that
 * skips `onMemoryChanged` leaves the memory unindexed — or, for a removal, still indexed —
 * and that is the main hazard of reaching for the repository directly.
 */

/**
 * A `source` holds the page as `fetch_url` showed it to the model (16k characters); a
 * fact written by the tool is capped at 4k. Room above both for the dashboard's edits.
 */
export const MEMORY_CONTENT_MAX_CHARS = 32_000;
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
}

export const createMemoryService = async (
  db: DB,
  input: CreateMemoryServiceInput,
  hooks: MemoryHooks
): Promise<AgentMemory> => {
  const row = await createAgentMemory(db, {
    kind: input.kind,
    status: input.status,
    title: assertTitle(input.title),
    content: assertContent(input.content),
    sourceUrl: input.sourceUrl ? normalizeSourceUrl(input.sourceUrl) : null,
    sessionId: input.sessionId ?? null,
  });

  await hooks.onMemoryChanged?.(row.id);

  return row;
};

export interface RecordSourceMemoryServiceInput {
  sourceUrl: string;
  title: string;
  content: string;
  sessionId?: string | null;
}

/**
 * The `fetch_url` trail: one row per page, refreshed on every visit. The index run is only
 * scheduled when the stored text changed — an unchanged revisit would rewrite nothing.
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

  if (result.changed) {
    await hooks.onMemoryChanged?.(result.id);
  }

  return result;
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
