import { oc } from "@orpc/contract";
import * as z from "zod";

import { AGENT_MEMORY_KIND, AGENT_MEMORY_STATUS } from "@chia/db/schema";

import {
  MEMORY_CONTENT_MAX_CHARS,
  MEMORY_TITLE_MAX_CHARS,
} from "../../memories/write";

import { withMetaSchema } from "./shared";

/**
 * RPC-only and admin-only. A memory is unpublished research; an active lesson is a
 * standing instruction. See `../routes/memory.route.ts`.
 */

export const memoryKindSchema = z.enum(AGENT_MEMORY_KIND);
export const memoryStatusSchema = z.enum(AGENT_MEMORY_STATUS);

const memorySummaryFields = {
  id: z.number(),
  kind: memoryKindSchema,
  status: memoryStatusSchema,
  title: z.string(),
  sourceUrl: z.string().nullable(),
  /** Provenance; null once the session is gone. */
  sessionId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
};

const memoryListItemSchema = z.object({
  ...memorySummaryFields,
  /** Truncated `content`. The full text is a `get` away. */
  preview: z.string(),
});

const memoryDetailSchema = z.object({
  ...memorySummaryFields,
  content: z.string(),
});

const readErrors = {
  UNAUTHORIZED: {},
  FORBIDDEN: {},
  INTERNAL_SERVER_ERROR: {},
};
const writeErrors = {
  ...readErrors,
  NOT_FOUND: {},
  BAD_REQUEST: {},
} as const;

const memoryIdSchema = z.object({ id: z.number().int().positive() });

export const listMemoriesContract = oc
  .errors(readErrors)
  .input(
    z.object({
      kind: memoryKindSchema.optional(),
      status: memoryStatusSchema.optional(),
      /** Substring match on title and content. */
      query: z.string().max(200).optional(),
      /** Inclusive id the page starts at. */
      cursor: z.number().int().nullish(),
      limit: z.number().int().min(1).max(100).optional(),
    })
  )
  .output(
    withMetaSchema(memoryListItemSchema).extend({
      /** Narrowed from `withMetaSchema`: this cursor is a memory id. */
      nextCursor: z.number().nullable(),
    })
  );

export const getMemoryContract = oc
  .errors({ ...readErrors, NOT_FOUND: {} })
  .input(memoryIdSchema)
  .output(z.object({ memory: memoryDetailSchema }));

/** Every write re-indexes; the route hands the hook to `memories/write.ts`. */
export const updateMemoryContract = oc
  .errors(writeErrors)
  .input(
    memoryIdSchema.extend({
      title: z.string().min(1).max(MEMORY_TITLE_MAX_CHARS).optional(),
      content: z.string().min(1).max(MEMORY_CONTENT_MAX_CHARS).optional(),
      status: memoryStatusSchema.optional(),
      /** `null` clears it. */
      sourceUrl: z.string().nullable().optional(),
    })
  )
  .output(z.object({ memory: memoryDetailSchema }));

/** Soft delete; the chunks go on the next index run. */
export const removeMemoryContract = oc
  .errors(writeErrors)
  .input(memoryIdSchema)
  .output(memoryIdSchema);

/** `pending → active`. Kept separate so the audit trail of who approved a lesson is one procedure. */
export const approveLessonContract = oc
  .errors(writeErrors)
  .input(memoryIdSchema)
  .output(z.object({ memory: memoryDetailSchema }));

/** Starts the reflection run for one session; lessons land as `pending`. */
export const consolidateMemoryContract = oc
  .errors({
    ...readErrors,
    TOO_MANY_REQUESTS: {},
    SERVICE_UNAVAILABLE: {
      message: "Memory consolidation is not available in this process.",
    },
  })
  .input(z.object({ sessionId: z.string().min(1) }))
  .output(z.object({ runId: z.string() }));

export type MemoryListItem = z.infer<typeof memoryListItemSchema>;
export type MemoryDetail = z.infer<typeof memoryDetailSchema>;
