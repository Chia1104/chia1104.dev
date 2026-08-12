import { indexing, tokenizer } from "@paradedb/drizzle-paradedb";
import { sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";

import { timestamps } from "../libs/common.schema.ts";

import { feeds, feedTranslations } from "./contents.schema.ts";
import { locale } from "./enums.ts";
import { pgTable } from "./table.ts";
import { user } from "./user.schema.ts";

const { paradedbIndex, paradedbField } = indexing;
const { icu, simple } = tokenizer;

/**
 * `@paradedb/drizzle-paradedb` resolves its own `drizzle-orm` instance, whose
 * `PgColumn`/`SQLWrapper` are not assignable to this package's. The casts derive
 * their target from the helpers so they follow whichever instance the package
 * resolves.
 */
type ParadedbIndexArgs = Parameters<ReturnType<typeof paradedbIndex>["on"]>;
const pdbKeyField = (column: unknown) => column as ParadedbIndexArgs[0];
const pdbField = (column: unknown) => column as ParadedbIndexArgs[1];
const pdbTokenized = (column: unknown) =>
  column as Parameters<typeof paradedbField>[0];

/** Every source column that can own a chunk. Add one per new resource type. */
const CHUNK_SOURCE_COLUMNS = ["feed_translation_id"] as const;

export const RESOURCE_CHUNK_KIND = {
  /** One per resource: title + summary + tags + outline. Bounded in size. */
  Card: "card",
  /** A section of the body. */
  Section: "section",
} as const;

export type ResourceChunkKind =
  (typeof RESOURCE_CHUNK_KIND)[keyof typeof RESOURCE_CHUNK_KIND];

/**
 * Retrievable unit of any resource.
 *
 * `source_type` / `source_id` are generated from the nullable foreign keys, so
 * callers never need to know how many key columns exist. A new resource type
 * means: one nullable FK, one more branch in each generated expression, and one
 * more entry in the CHECK.
 *
 * `locale` / `published` / `deleted` are mirrored from the source because
 * ParadeDB only pushes a predicate into the BM25 index when it is a column of
 * the indexed table. The indexing workflow is the only writer.
 */
export const resourceChunks = pgTable(
  "resource_chunk",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    feedTranslationId: integer("feed_translation_id").references(
      () => feedTranslations.id,
      { onDelete: "cascade" }
    ),

    // NOT NULL is safe: the CHECK below guarantees exactly one key column is
    // set, so the expressions always produce a value.
    sourceType: text("source_type")
      .notNull()
      .generatedAlwaysAs(
        sql`case when "feed_translation_id" is not null then 'feed_translation' end`
      ),
    sourceId: integer("source_id")
      .notNull()
      .generatedAlwaysAs(sql`coalesce("feed_translation_id")`),

    kind: text("kind", {
      enum: [RESOURCE_CHUNK_KIND.Card, RESOURCE_CHUNK_KIND.Section],
    }).notNull(),
    /** 0-based within `kind`; always 0 for a card. */
    chunkIndex: integer("chunk_index").notNull().default(0),
    content: text("content").notNull(),
    /** e.g. `"HNSW > ef_search"` — used to build citation anchors. */
    headingPath: text("heading_path"),
    tokenCount: integer("token_count"),
    metadata: jsonb("metadata"),
    /** sha-256 of `content`; drives per-chunk re-embedding. */
    contentHash: text("content_hash").notNull(),

    locale: locale("locale"),
    published: boolean("published").notNull().default(false),
    deleted: boolean("deleted").notNull().default(false),

    ...timestamps,
  },
  (table) => [
    check(
      "resource_chunk_single_source",
      sql`num_nonnulls(${sql.raw(CHUNK_SOURCE_COLUMNS.map((column) => `"${column}"`).join(", "))}) = 1`
    ),
    uniqueIndex("resource_chunk_source_kind_index_idx").on(
      table.sourceType,
      table.sourceId,
      table.kind,
      table.chunkIndex
    ),
    index("resource_chunk_source_idx").on(table.sourceType, table.sourceId),
    index("resource_chunk_feed_translation_id_idx").on(table.feedTranslationId),
    /**
     * `icu` segments Traditional Chinese and keeps identifiers such as
     * `ef_search` whole. It does not split on `.` between alphanumerics, so
     * `hnsw.ef_search` indexes as one token — the `body_sub` alias (`simple`,
     * splits on every non-alphanumeric) exists so a phrase query can still
     * reach the sub-identifier. Query Chinese against the `icu` field only:
     * `simple` emits a CJK run as a single token.
     */
    paradedbIndex("resource_chunk_bm25_idx").on(
      pdbKeyField(table.id),
      paradedbField(pdbTokenized(table.content), icu()),
      paradedbField(pdbTokenized(table.content), simple({ alias: "body_sub" })),
      pdbField(table.sourceType),
      pdbField(table.kind),
      pdbField(table.locale),
      pdbField(table.published),
      pdbField(table.deleted)
    ),
  ]
);

/**
 * Vectors for a chunk, one row per model.
 *
 * Split from the chunk so re-embedding does not rewrite the text, and so
 * "which chunks need embedding" is a left join on
 * `(chunk_id, model, index_version)`.
 *
 * pgvector fixes the dimension per column, and this is the only one. A model
 * with a different native width is rejected at startup by
 * `resolveEmbeddingProvider`; adopting one means changing this column and
 * reindexing, not adding a second column — the two-column setup this replaced
 * cost a dimension branch in every read and write and was never queried.
 */
export const resourceEmbeddings = pgTable(
  "resource_embedding",
  {
    chunkId: bigint("chunk_id", { mode: "number" })
      .notNull()
      .references(() => resourceChunks.id, { onDelete: "cascade" }),
    /** `EmbeddingProvider.id` */
    model: text("model").notNull(),
    /** Preprocessing / chunking strategy version. */
    indexVersion: text("index_version").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.chunkId, table.model] }),
    index("resource_embedding_model_idx").on(table.model),
    index("resource_embedding_hnsw_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
  ]
);

export const RESOURCE_INDEX_RUN_SCOPE = {
  /** One `(source_type, source_id)` pair. */
  Resource: "resource",
  /** Every translation of one feed. */
  Feed: "feed",
  /** Every indexable resource. */
  All: "all",
} as const;

export type ResourceIndexRunScope =
  (typeof RESOURCE_INDEX_RUN_SCOPE)[keyof typeof RESOURCE_INDEX_RUN_SCOPE];

export const RESOURCE_INDEX_RUN_STATUS = {
  Pending: "pending",
  Running: "running",
  Completed: "completed",
  Failed: "failed",
  Cancelled: "cancelled",
} as const;

export type ResourceIndexRunStatus =
  (typeof RESOURCE_INDEX_RUN_STATUS)[keyof typeof RESOURCE_INDEX_RUN_STATUS];

/** The statuses the partial unique indexes below treat as occupying a target. */
export const RESOURCE_INDEX_RUN_ACTIVE_STATUSES: ResourceIndexRunStatus[] = [
  RESOURCE_INDEX_RUN_STATUS.Pending,
  RESOURCE_INDEX_RUN_STATUS.Running,
];

export interface ResourceIndexRunProgress {
  done: number;
  total: number;
  /** `source_id`s that threw; the run still finishes. */
  failed: number[];
}

/**
 * One indexing trigger and its outcome.
 *
 * The three partial unique indexes turn a repeated trigger into a conflict, so
 * the caller can be handed the in-flight run instead of starting a second one.
 * They only constrain active rows, so a finalized run never blocks the next
 * trigger — a run that dies without finalizing does, which is why every read of
 * an active run reconciles it against the workflow runtime first.
 *
 * `feed_id` is `ON DELETE SET NULL` because "a reindex ran for this feed" stays
 * meaningful after the feed is hard-deleted. `source_id` has no foreign key:
 * `resource_chunk.source_id` is a generated column, not a referencable key, so
 * orphans are read through `scope` instead.
 */
export const resourceIndexRuns = pgTable(
  "resource_index_run",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** Workflow runtime run id; the handle for reconciling `status`. */
    externalRunId: text("external_run_id").notNull(),
    scope: text("scope").$type<ResourceIndexRunScope>().notNull(),
    /** Set when `scope` is `resource`. */
    sourceType: text("source_type"),
    sourceId: integer("source_id"),
    feedId: integer("feed_id").references(() => feeds.id, {
      onDelete: "set null",
    }),
    status: text("status")
      .$type<ResourceIndexRunStatus>()
      .notNull()
      .default(RESOURCE_INDEX_RUN_STATUS.Pending),
    triggeredBy: text("triggered_by").references(() => user.id),
    /** `EmbeddingProvider.id` this run embedded with. */
    model: text("model").notNull(),
    indexVersion: text("index_version").notNull(),
    /** Written per resource by a bulk run; `null` for single-resource runs. */
    progress: jsonb("progress").$type<ResourceIndexRunProgress>(),
    result: jsonb("result"),
    error: text("error"),
    startedAt: timestamp("started_at", { mode: "date" }),
    endedAt: timestamp("ended_at", { mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("resource_index_run_source_idx").on(table.sourceType, table.sourceId),
    index("resource_index_run_external_id_idx").on(table.externalRunId),
    uniqueIndex("resource_index_run_active_resource_idx")
      .on(table.sourceType, table.sourceId)
      .where(
        sql`${table.scope} = 'resource' and ${table.status} in ('pending', 'running')`
      ),
    uniqueIndex("resource_index_run_active_feed_idx")
      .on(table.feedId)
      .where(
        sql`${table.scope} = 'feed' and ${table.status} in ('pending', 'running')`
      ),
    uniqueIndex("resource_index_run_active_all_idx")
      .on(table.scope)
      .where(
        sql`${table.scope} = 'all' and ${table.status} in ('pending', 'running')`
      ),
  ]
);

export type ResourceChunk = InferSelectModel<typeof resourceChunks>;
export type ResourceEmbedding = InferSelectModel<typeof resourceEmbeddings>;
export type ResourceIndexRun = InferSelectModel<typeof resourceIndexRuns>;
