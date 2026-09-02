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

import { agentMemories } from "./agent.schema.ts";
import { feeds, feedTranslations } from "./contents.schema.ts";
import { locale } from "./enums.ts";
import { pgTable } from "./table.ts";
import { user } from "./user.schema.ts";

const { paradedbIndex, paradedbField } = indexing;
const { icu, simple } = tokenizer;

/**
 * `@paradedb/drizzle-paradedb` resolves a separate `drizzle-orm` whose column types are not assignable here.
 * Casts derive their target from the helpers so they follow whichever instance the package resolves.
 */
type ParadedbIndexArgs = Parameters<ReturnType<typeof paradedbIndex>["on"]>;
const pdbKeyField = <TColumn>(column: TColumn) =>
  // SAFETY: ParadeDB accepts the same Drizzle column at runtime across duplicated type instances.
  column as ParadedbIndexArgs[0];
const pdbField = <TColumn>(column: TColumn) =>
  // SAFETY: ParadeDB accepts the same Drizzle column at runtime across duplicated type instances.
  column as ParadedbIndexArgs[1];
const pdbTokenized = <TColumn>(column: TColumn) =>
  // SAFETY: ParadeDB accepts the same Drizzle column at runtime across duplicated type instances.
  column as Parameters<typeof paradedbField>[0];

/** Every source column that can own a chunk. Add one per new resource type. */
const CHUNK_SOURCE_COLUMNS = [
  "feed_translation_id",
  "agent_memory_id",
] as const;

export const RESOURCE_CHUNK_KIND = {
  /** One per resource: title + summary + tags + outline. Bounded in size. */
  Card: "card",
  Section: "section",
} as const;

export type ResourceChunkKind =
  (typeof RESOURCE_CHUNK_KIND)[keyof typeof RESOURCE_CHUNK_KIND];

/**
 * Retrievable unit of any resource. `source_type` / `source_id` are generated from the nullable FKs so callers never pick a key column.
 * `locale` / `published` / `deleted` are mirrored because ParadeDB only pushes a BM25 predicate when it is a column of the indexed table.
 */
export const resourceChunks = pgTable(
  "resource_chunk",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    feedTranslationId: integer("feed_translation_id").references(
      () => feedTranslations.id,
      { onDelete: "cascade" }
    ),
    agentMemoryId: integer("agent_memory_id").references(
      () => agentMemories.id,
      { onDelete: "cascade" }
    ),

    // NOT NULL is safe: the CHECK below guarantees exactly one key column is
    // set, so the expressions always produce a value.
    sourceType: text("source_type")
      .notNull()
      .generatedAlwaysAs(
        sql`case when "feed_translation_id" is not null then 'feed_translation' when "agent_memory_id" is not null then 'agent_memory' end`
      ),
    sourceId: integer("source_id")
      .notNull()
      .generatedAlwaysAs(
        sql`coalesce("feed_translation_id", "agent_memory_id")`
      ),

    kind: text("kind", {
      enum: [RESOURCE_CHUNK_KIND.Card, RESOURCE_CHUNK_KIND.Section],
    }).notNull(),
    /** 0-based within `kind`; always 0 for a card. */
    chunkIndex: integer("chunk_index").notNull().default(0),
    content: text("content").notNull(),
    /** Citation path, e.g. `"HNSW > ef_search"`. */
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
    index("resource_chunk_agent_memory_id_idx").on(table.agentMemoryId),
    /**
     * `icu` segments Traditional Chinese and keeps identifiers such as `ef_search` whole.
     * `body_sub` (`simple`) splits dotted paths so a phrase query can reach the sub-identifier; query Chinese against `icu` only.
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
 * Split so re-embedding does not rewrite the text. pgvector fixes the dimension per column; a different native width means changing this column and reindexing.
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
 * One indexing trigger. Partial unique indexes on active rows turn a repeated trigger into a conflict; a run that dies without finalizing still occupies the target.
 * `feed_id` is ON DELETE SET NULL; `source_id` has no FK because `resource_chunk.source_id` is generated.
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
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
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
