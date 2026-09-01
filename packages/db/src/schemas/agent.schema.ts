import { sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  bigint,
  bigserial,
  index,
  integer,
  jsonb,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type { JsonObject } from "@chia/utils/json";

import { timestamps, softDelete } from "../libs/common.schema.ts";

import { feeds } from "./contents.schema.ts";
import { locale } from "./enums.ts";
import { agentSchema } from "./table.ts";
import { user } from "./user.schema.ts";

/**
 * Shared session, run, entry and approval tables in the `agent` schema, unprefixed.
 * The transcript is a tree: `session_entry.parentId` is the branch, `session.leafEntryId` is the active leaf.
 */

/**
 * Application-generated uuidv7; ids travel through model context and the event stream, so they must be opaque.
 */
export const agentSessions = agentSchema.table(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Stable runtime registry key, e.g. `writing` or `site-assistant`. */
    kind: text("kind").notNull(),
    title: text("title"),
    /** Nullable; a harness that needs a model validates these at runtime. */
    providerId: text("provider_id"),
    modelId: text("model_id"),
    thinkingLevel: text("thinking_level"),
    /** `null` means "every registered tool is active". */
    activeToolNames: jsonb("active_tool_names").$type<string[] | null>(),
    /** Tool tiers the operator pre-approved for this session, e.g. `["draft"]`. */
    autoApprove: jsonb("auto_approve").$type<string[]>().notNull().default([]),
    /** Kind-owned configuration that does not deserve a shared column. */
    runtimeConfig: jsonb("runtime_config")
      .$type<JsonObject>()
      .notNull()
      .default({}),
    /** Schema version for validating and migrating `runtimeConfig`. */
    configVersion: integer("config_version").notNull().default(1),
    /** Active leaf of the session tree. `null` for a fresh session with no entries. */
    leafEntryId: text("leaf_entry_id"),
    /** Fork source. `forkedFromEntryId` is `null` for a whole-tree copy; SET NULL on source delete. */
    forkedFromSessionId: text("forked_from_session_id").references(
      (): AnyPgColumn => agentSessions.id,
      { onDelete: "set null" }
    ),
    forkedFromEntryId: text("forked_from_entry_id"),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index("agent_session_user_id_idx").on(table.userId),
    index("agent_session_user_kind_idx").on(table.userId, table.kind),
    index("agent_session_deleted_at_idx").on(table.deletedAt),
    index("agent_session_updated_at_idx").on(table.updatedAt),
  ]
);

export type AgentSession = InferSelectModel<typeof agentSessions>;

export type AgentRunStatus = "active" | "completed" | "cancelled" | "failed";

/**
 * One harness execution. Separate from the session so retries and sub-runs do not share a row.
 */
export const agentRuns = agentSchema.table(
  "run",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => agentSessions.id, { onDelete: "cascade" }),
    harnessKind: text("harness_kind").notNull(),
    harnessVersion: integer("harness_version").notNull().default(1),
    status: text("status").$type<AgentRunStatus>().notNull().default("active"),
    /** Provider/workflow-owned identifier used to stream, resume or cancel this run. */
    externalRunId: text("external_run_id").notNull(),
    metadata: jsonb("metadata").$type<JsonObject>().notNull().default({}),
    startedAt: timestamp("started_at", { mode: "date" }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { mode: "date" }),
  },
  (table) => [
    index("agent_run_session_status_idx").on(table.sessionId, table.status),
    uniqueIndex("agent_run_external_id_idx").on(table.externalRunId),
    uniqueIndex("agent_run_one_active_per_session_idx")
      .on(table.sessionId)
      .where(sql`${table.status} = 'active'`),
  ]
);

export type AgentRun = InferSelectModel<typeof agentRuns>;

/**
 * One tree node. `type`/`payload` stay opaque so harnesses can add entry types without a migration.
 * `seq` is a table-wide `bigserial` taken at insert; under one writer per session, `seq <= n` is everything persisted before this point.
 */
export const agentSessionEntries = agentSchema.table(
  "session_entry",
  {
    seq: bigserial("seq", { mode: "number" }).notNull(),
    id: text("id").notNull(),
    sessionId: text("session_id")
      .notNull()
      .references(() => agentSessions.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<JsonObject>().notNull(),
    timestamp: timestamp("timestamp", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.id] }),
    index("agent_session_entry_seq_idx").on(table.sessionId, table.seq),
    index("agent_session_entry_parent_idx").on(table.sessionId, table.parentId),
    index("agent_session_entry_type_idx").on(table.sessionId, table.type),
  ]
);

export type AgentSessionEntry = InferSelectModel<typeof agentSessionEntries>;

/** Writing-agent extension. Other kinds add sibling tables rather than nullable columns on `session`. */
export const writingAgentSessions = agentSchema.table(
  "writing_session",
  {
    sessionId: text("session_id")
      .primaryKey()
      .references(() => agentSessions.id, { onDelete: "cascade" }),
    targetFeedId: integer("target_feed_id").references(() => feeds.id, {
      onDelete: "set null",
    }),
    /** Feed-level draft fields (slug/type/published/mainImage/…). */
    feedMeta: jsonb("feed_meta").$type<JsonObject>().notNull().default({}),
  },
  (table) => [
    index("writing_agent_session_target_feed_idx").on(table.targetFeedId),
  ]
);

export type WritingAgentSession = InferSelectModel<typeof writingAgentSessions>;

/** Per-locale staging buffer; mirrors `feed_translation` so `commit_draft` maps onto `createFeedSchema.translations`. */
export const writingAgentDrafts = agentSchema.table(
  "writing_draft",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => agentSessions.id, { onDelete: "cascade" }),
    locale: locale("locale").notNull(),
    /** title/excerpt/description/summary. jsonb so adding a field needs no migration. */
    meta: jsonb("meta").$type<JsonObject>().notNull().default({}),
    content: text("content"),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.sessionId, table.locale] })]
);

export type WritingAgentDraft = InferSelectModel<typeof writingAgentDrafts>;

export const AGENT_MEMORY_KIND = {
  /** A page the agent read: URL, title, excerpt. Written automatically by `fetch_url`. */
  Source: "source",
  Fact: "fact",
  /** A writing preference or lesson extracted from the operator's feedback. */
  Lesson: "lesson",
} as const;

export type AgentMemoryKind =
  (typeof AGENT_MEMORY_KIND)[keyof typeof AGENT_MEMORY_KIND];

export const AGENT_MEMORY_STATUS = {
  Active: "active",
  /** A lesson awaiting the operator's review; never injected into a prompt. */
  Pending: "pending",
  /** Retired by the operator; dropped from the index but kept for provenance. */
  Archived: "archived",
} as const;

export type AgentMemoryStatus =
  (typeof AGENT_MEMORY_STATUS)[keyof typeof AGENT_MEMORY_STATUS];

/**
 * Long-term memory across sessions. `id` is serial because `resource_chunk.source_id` is an integer.
 * `session_id` is provenance only and SET NULL when the session goes.
 */
export const agentMemories = agentSchema.table(
  "memory",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").$type<AgentMemoryKind>().notNull(),
    status: text("status")
      .$type<AgentMemoryStatus>()
      .notNull()
      .default(AGENT_MEMORY_STATUS.Active),
    /** One line; what the volatile context and the dashboard list show. */
    title: text("title").notNull(),
    /** Markdown. Chunked and embedded like a post body. */
    content: text("content").notNull(),
    /** Required for a `source`, expected on a `fact`, null on a `lesson`. */
    sourceUrl: text("source_url"),
    sessionId: text("session_id").references(() => agentSessions.id, {
      onDelete: "set null",
    }),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    /** `fetch_url` upserts on the page URL; the predicate is what `ON CONFLICT` must repeat. */
    uniqueIndex("agent_memory_source_url_idx")
      .on(table.sourceUrl)
      .where(
        sql`${table.kind} = '${sql.raw(AGENT_MEMORY_KIND.Source)}' and ${table.deletedAt} is null`
      ),
    index("agent_memory_session_id_idx").on(table.sessionId),
    index("agent_memory_kind_status_idx").on(table.kind, table.status),
  ]
);

export type AgentMemory = InferSelectModel<typeof agentMemories>;

/**
 * Operator overrides of a kind's defaults for new sessions; existing sessions are not updated.
 * Nullable LLM columns defer to the definition; an unregistered `kind` is inert.
 */
export const agentKindConfigs = agentSchema.table("kind_config", {
  kind: text("kind").primaryKey(),
  providerId: text("provider_id"),
  modelId: text("model_id"),
  thinkingLevel: text("thinking_level"),
  /** `null` defers to the definition; a session created with an explicit list still wins. */
  autoApprove: jsonb("auto_approve").$type<string[] | null>(),
  config: jsonb("config").$type<JsonObject>().notNull().default({}),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type AgentKindConfig = InferSelectModel<typeof agentKindConfigs>;

/** Sampling parameters an operator may override on a task; every field optional. */
export interface AgentTaskParams {
  maxTokens?: number;
  temperature?: number;
}

/**
 * Operator overrides of a named one-shot task. `provider_id` and `model_id` are set together or not at all.
 */
export const agentTaskConfigs = agentSchema.table("task_config", {
  taskId: text("task_id").primaryKey(),
  providerId: text("provider_id"),
  modelId: text("model_id"),
  /** Replaces the task's default system prompt; `null` restores it. */
  systemPrompt: text("system_prompt"),
  params: jsonb("params").$type<AgentTaskParams>().notNull().default({}),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type AgentTaskConfig = InferSelectModel<typeof agentTaskConfigs>;

/** The single `quota_config` row; a per-tier split is another row, not a schema change. */
export const AGENT_QUOTA_CONFIG_ID = "default";

/**
 * Usage quota for callers below `Root`. All fields nullable; `null` defers to the code default.
 * `weeklyLimitMicros` is micro-dollars, the ledger's unit.
 */
export const agentQuotaConfigs = agentSchema.table("quota_config", {
  id: text("id").primaryKey(),
  weeklyLimitMicros: bigint("weekly_limit_micros", { mode: "number" }),
  /** An IANA zone; the week resets on its Monday 00:00. */
  resetTimeZone: text("reset_time_zone"),
  /** Turns one user may have running across all their sessions; the single-replica runner's guard. */
  maxRunningTurns: integer("max_running_turns"),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type AgentQuotaConfig = InferSelectModel<typeof agentQuotaConfigs>;

export type AgentApprovalStatus = "pending" | "approved" | "rejected";

/**
 * Durable tier-3 approval, keyed by `toolCallId`. Survives process restart so reconnects and audit still see the decision.
 */
export const agentToolApprovals = agentSchema.table(
  "tool_approval",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => agentSessions.id, { onDelete: "cascade" }),
    toolCallId: text("tool_call_id").notNull(),
    toolName: text("tool_name").notNull(),
    args: jsonb("args").$type<JsonObject>(),
    status: text("status")
      .$type<AgentApprovalStatus>()
      .notNull()
      .default("pending"),
    comment: text("comment"),
    decidedBy: text("decided_by").references(() => user.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.sessionId, table.toolCallId] })]
);

export type AgentToolApproval = InferSelectModel<typeof agentToolApprovals>;

/** What produced the row: the turn, or a side job. A kind that adds a task adds its name here. */
export type AgentUsageSource =
  | "turn"
  | "compaction"
  | "branch_summary"
  | "title"
  | "lessons";

/**
 * One billed provider call, attributed to the user. Entries cascade with the session, so usage lives here; `session_id` is SET NULL when the session goes.
 * `cost_micros` is pi's `usage.cost.total` in micro-dollars; token columns are breakdown, not metering.
 */
export const agentUsageLedger = agentSchema.table(
  "usage_ledger",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => agentSessions.id, {
      onDelete: "set null",
    }),
    runId: text("run_id").references(() => agentRuns.id, {
      onDelete: "set null",
    }),
    /** Tree entry that carries this usage. `null` for a side job. */
    entryId: text("entry_id"),
    kind: text("kind").notNull(),
    source: text("source").$type<AgentUsageSource>().notNull(),
    providerId: text("provider_id").notNull(),
    modelId: text("model_id").notNull(),
    input: integer("input").notNull(),
    output: integer("output").notNull(),
    cacheRead: integer("cache_read").notNull(),
    cacheWrite: integer("cache_write").notNull(),
    /** Subset of `output`; only some providers report it. */
    reasoning: integer("reasoning"),
    costMicros: bigint("cost_micros", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    /** The quota read: one user's spend over a period. */
    index("agent_usage_ledger_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
    index("agent_usage_ledger_session_id_idx").on(table.sessionId),
  ]
);

export type AgentUsageLedgerRow = InferSelectModel<typeof agentUsageLedger>;
