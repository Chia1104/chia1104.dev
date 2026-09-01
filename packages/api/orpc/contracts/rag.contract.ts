import { oc } from "@orpc/contract";
import * as z from "zod";

import {
  RESOURCE_CHUNK_KIND,
  RESOURCE_INDEX_RUN_SCOPE,
  RESOURCE_INDEX_RUN_STATUS,
} from "@chia/db/schema";
import { locale } from "@chia/db/schema/enums";

import { isResourceType, resourceTypes } from "../../resources/registry";

import { withMetaSchema } from "./shared";

/**
 * RPC-only; every consumer is the dashboard's browser client. Every output carries the
 * index key it was computed under: "embedded" is only ever true relative to a
 * `(model, index_version)` pair. Every procedure is admin-only at the route layer.
 */

/** The `(model, index_version)` pair the response was computed against. */
const indexKeyFields = {
  model: z.string(),
  indexVersion: z.string(),
};

const chunkStateSchema = z.enum(["current", "stale", "missing"]);

const runStatusSchema = z.enum(RESOURCE_INDEX_RUN_STATUS);

const indexCountsSchema = z.object({
  total: z.number(),
  current: z.number(),
  stale: z.number(),
  missing: z.number(),
});

/**
 * Rejected at the boundary rather than inside `getResourceAdapter`, matching
 * `resourceIndexRequestSchema` — a bad source type must not become a workflow run that
 * retries its way to failure.
 */
const resourceRefSchema = z.object({
  sourceType: z.string().refine(isResourceType, {
    message: `Must be one of: ${resourceTypes.join(", ")}`,
  }),
  sourceId: z.number().int().positive(),
});

const chunkStatusSchema = z.object({
  chunkId: z.number(),
  kind: z.enum(RESOURCE_CHUNK_KIND),
  chunkIndex: z.number(),
  headingPath: z.string().nullable(),
  tokenCount: z.number().nullable(),
  contentHash: z.string(),
  locale: z.enum(locale.enumValues).nullable(),
  published: z.boolean(),
  deleted: z.boolean(),
  state: chunkStateSchema,
  updatedAt: z.date(),
});

const chunkListItemSchema = chunkStatusSchema.extend({
  sourceType: z.string(),
  sourceId: z.number(),
  /** Truncated `content`. The full text is a `chunk:get` away. */
  preview: z.string(),
});

const chunkDetailSchema = chunkStatusSchema.extend({
  sourceType: z.string(),
  sourceId: z.number(),
  content: z.string(),
  metadata: z.unknown(),
  createdAt: z.date(),
  /** Every stored vector, so a leftover key is visible rather than inferred. */
  vectors: z.array(
    z.object({
      model: z.string(),
      indexVersion: z.string(),
      updatedAt: z.date(),
    })
  ),
});

const embeddingKeyCountSchema = z.object({
  model: z.string(),
  indexVersion: z.string(),
  count: z.number(),
});

/**
 * The id alone, never a status: these procedures do not reconcile against the workflow
 * runtime, so a status read here could be a stale `running`. The dashboard hands the id
 * to `rag["run:get"]`, which does reconcile.
 */
const activeRunIdSchema = z.string().nullable();

const runSnapshotSchema = z.object({
  runId: z.string(),
  recordId: z.number(),
  scope: z.enum(RESOURCE_INDEX_RUN_SCOPE),
  sourceType: z.string().nullable(),
  sourceId: z.number().nullable(),
  feedId: z.number().nullable(),
  status: runStatusSchema,
  /** The run's own index key, which may predate the current one. */
  model: z.string(),
  indexVersion: z.string(),
  progress: z
    .object({
      done: z.number(),
      total: z.number(),
      failed: z.array(z.number()),
    })
    .nullable(),
  result: z.unknown(),
  error: z.string().nullable(),
  triggeredBy: z.string().nullable(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
  createdAt: z.date(),
});

const runHandleSchema = z.object({
  ...indexKeyFields,
  runId: z.string(),
  recordId: z.number(),
  status: runStatusSchema,
  /** True when an in-flight run was handed back instead of a new one started. */
  reused: z.boolean(),
});

const triggerErrors = {
  UNAUTHORIZED: {},
  FORBIDDEN: {},
  TOO_MANY_REQUESTS: {},
  SERVICE_UNAVAILABLE: {
    message: "Indexing is not available in this process.",
  },
  INTERNAL_SERVER_ERROR: {},
} as const;

export const getRagOverviewContract = oc
  .errors({ UNAUTHORIZED: {}, FORBIDDEN: {}, INTERNAL_SERVER_ERROR: {} })
  .output(
    z.object({
      ...indexKeyFields,
      counts: indexCountsSchema,
      bySourceType: z.array(
        z.object({ sourceType: z.string(), counts: indexCountsSchema })
      ),
      byLocale: z.array(
        z.object({
          locale: z.enum(locale.enumValues).nullable(),
          counts: indexCountsSchema,
        })
      ),
      byKind: z.array(
        z.object({
          kind: z.enum(RESOURCE_CHUNK_KIND),
          counts: indexCountsSchema,
        })
      ),
      byVisibility: z.array(
        z.object({
          published: z.boolean(),
          deleted: z.boolean(),
          counts: indexCountsSchema,
        })
      ),
      /** Vectors per stored key — how leftovers from an older key show up. */
      byIndexKey: z.array(embeddingKeyCountSchema),
      /** Chunks with no vector on the current key: `stale` plus `missing`. */
      needingEmbedding: z.number(),
      /** The `all`-scope run in flight, if any. */
      activeRunId: activeRunIdSchema,
    })
  );

export const listRagChunksContract = oc
  .errors({ UNAUTHORIZED: {}, FORBIDDEN: {}, INTERNAL_SERVER_ERROR: {} })
  .input(
    z.object({
      sourceType: z.string().optional(),
      locale: z.enum(locale.enumValues).optional(),
      kind: z.enum(RESOURCE_CHUNK_KIND).optional(),
      state: chunkStateSchema.optional(),
      /** Substring match on `content`. */
      query: z.string().max(200).optional(),
      /** Inclusive `chunkId` the page starts at. */
      cursor: z.number().int().nullish(),
      limit: z.number().int().min(1).max(100).optional(),
    })
  )
  .output(
    withMetaSchema(chunkListItemSchema).extend({
      ...indexKeyFields,
      /**
       * Narrowed from `withMetaSchema`'s `string | number`: this cursor is a chunk id,
       * and the input only accepts a number, so widening it here would force every
       * caller to coerce on the way back in.
       */
      nextCursor: z.number().nullable(),
    })
  );

export const getRagChunkContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(z.object({ chunkId: z.number().int().positive() }))
  .output(z.object({ ...indexKeyFields, chunk: chunkDetailSchema }));

export const getResourceIndexStatusContract = oc
  .errors({ UNAUTHORIZED: {}, FORBIDDEN: {}, INTERNAL_SERVER_ERROR: {} })
  .input(resourceRefSchema)
  .output(
    z.object({
      ...indexKeyFields,
      counts: indexCountsSchema,
      /** Ordered by kind then chunk index, as the drawer lists them. */
      chunks: z.array(chunkStatusSchema),
      /** The `resource`-scope run in flight for this ref, if any. */
      activeRunId: activeRunIdSchema,
    })
  );

export const listIndexRunsContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    SERVICE_UNAVAILABLE: {
      message: "Indexing is not available in this process.",
    },
    INTERNAL_SERVER_ERROR: {},
  })
  .input(
    z.object({
      limit: z.number().int().min(1).max(100).optional(),
      cursor: z.union([z.string(), z.number()]).nullish(),
    })
  )
  .output(withMetaSchema(runSnapshotSchema).extend(indexKeyFields));

export const getIndexRunContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    SERVICE_UNAVAILABLE: {
      message: "Indexing is not available in this process.",
    },
    INTERNAL_SERVER_ERROR: {},
  })
  .input(z.object({ runId: z.string().min(1) }))
  .output(z.object({ ...indexKeyFields, run: runSnapshotSchema }));

/** The numbers a full reindex has to show before it may be confirmed. */
export const previewReindexAllContract = oc
  .errors({ UNAUTHORIZED: {}, FORBIDDEN: {}, INTERNAL_SERVER_ERROR: {} })
  .output(
    z.object({
      ...indexKeyFields,
      /** Resources the run iterates: every feed translation plus every live memory. */
      targets: z.number(),
      counts: indexCountsSchema,
      needingEmbedding: z.number(),
      byIndexKey: z.array(embeddingKeyCountSchema),
    })
  );

export const indexResourceContract = oc
  .errors(triggerErrors)
  .input(resourceRefSchema)
  .output(runHandleSchema);

export const indexFeedContract = oc
  .errors(triggerErrors)
  .input(z.object({ feedId: z.number().int().positive() }))
  .output(runHandleSchema);

export const reindexAllContract = oc
  .errors(triggerErrors)
  .input(z.object({ onlyMissing: z.boolean().optional().default(false) }))
  .output(runHandleSchema);

export const pruneEmbeddingsContract = oc
  .errors(triggerErrors)
  .output(z.object({ ...indexKeyFields, deletedCount: z.number() }));

export type RagChunkState = z.infer<typeof chunkStateSchema>;
export type RagIndexCounts = z.infer<typeof indexCountsSchema>;
export type RagChunkListItem = z.infer<typeof chunkListItemSchema>;
export type RagChunkDetail = z.infer<typeof chunkDetailSchema>;
export type RagIndexRunSnapshot = z.infer<typeof runSnapshotSchema>;
