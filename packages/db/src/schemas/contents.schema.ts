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
  uniqueIndex,
  boolean,
} from "drizzle-orm/pg-core";

import { timestamps, softDelete } from "../libs/common.schema.ts";

import { locale, feedType } from "./enums.ts";
import type { FeedType, Locale } from "./enums.ts";
import { pgTable } from "./table.ts";
import { user } from "./user.schema.ts";

/** Post taxonomy. Set on the feed through `feeds.update`, never through a draft. */
export const tags = pgTable("tag", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  ...timestamps,
});

export const tagTranslations = pgTable(
  "tag_translation",
  {
    id: serial("id").primaryKey(),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    locale: locale("locale").notNull(),
    name: text("name").notNull(),
    description: text("description"),
  },
  (table) => [
    uniqueIndex("tag_translation_tag_locale_idx").on(table.tagId, table.locale),
  ]
);

const baseFeedsColumns = {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  type: feedType("type").notNull(),
  published: boolean("published").default(false).notNull(),
  defaultLocale: locale("default_locale").notNull().default("zh-TW"),
  ...timestamps,
  ...softDelete,
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  mainImage: text("main_image"),
};

export const feeds = pgTable("feed", baseFeedsColumns, (table) => [
  uniqueIndex("feed_slug_idx").on(table.slug),
  index("feed_user_id_idx").on(table.userId),
  index("feed_type_idx").on(table.type),
  index("feed_published_idx").on(table.published),
  index("feed_default_locale_idx").on(table.defaultLocale),
  index("feed_deleted_at_idx").on(table.deletedAt),
]);

/** Translation prose (MDX). `resource_chunk` mirrors `published` / `deleted` / `locale` from here. */
export const feedTranslations = pgTable(
  "feed_translation",
  {
    id: serial("id").primaryKey(),
    feedId: integer("feed_id")
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),
    locale: locale("locale").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    description: text("description"),
    summary: text("summary"),
    readTime: integer("read_time"),

    content: text("content"),

    /** Mirrored from `feed`; the source of truth for chunk visibility. */
    published: boolean("published").notNull().default(false),
    deleted: boolean("deleted").notNull().default(false),

    ...timestamps,
  },
  (table) => [
    uniqueIndex("feed_translation_feed_locale_idx").on(
      table.feedId,
      table.locale
    ),
    index("feed_translation_feed_id_idx").on(table.feedId),
    index("feed_translation_locale_idx").on(table.locale),
    index("feed_translation_title_idx").on(table.title),
  ]
);

/**
 * The working copy of one post, shared by the dashboard editor and the writing agent. `feed`
 * only changes when a draft is applied, which is also what commits a version of the draft, so
 * draft writes never start feed indexing.
 */
export const feedDrafts = pgTable(
  "feed_draft",
  {
    id: serial("id").primaryKey(),
    /** `null` until the draft is applied for the first time. One working draft per feed. */
    feedId: integer("feed_id").references(() => feeds.id, {
      onDelete: "cascade",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** `null` until an English/ASCII slug is chosen; required to apply a new post. */
    slug: text("slug"),
    type: feedType("type").notNull().default("post"),
    defaultLocale: locale("default_locale").notNull().default("zh-TW"),
    mainImage: text("main_image"),
    /** Orders writes; bumped under the row lock. `contentHash` is what identifies a version. */
    revision: integer("revision").notNull().default(1),
    /** `hashFeedDraftSnapshot` of the current content, rewritten by every write. */
    contentHash: text("content_hash").notNull(),
    /** The commit `feed` holds; `null` when never applied. Unapplied work is a differing `contentHash`. */
    appliedRevisionId: bigint("applied_revision_id", {
      mode: "number",
    }).references((): AnyPgColumn => feedDraftRevisions.id),
    /** Who wrote the current state; a different next writer keeps a safety point first. */
    lastAuthor: text("last_author").$type<FeedDraftAuthor>().notNull(),
    lastSessionId: text("last_session_id"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("feed_draft_feed_id_idx").on(table.feedId),
    index("feed_draft_user_id_idx").on(table.userId),
    index("feed_draft_updated_at_idx").on(table.updatedAt),
  ]
);

/** Per-locale draft fields; mirrors `feed_translation` minus `read_time` and `summary`, which workflows own. */
export const feedDraftTranslations = pgTable(
  "feed_draft_translation",
  {
    draftId: integer("draft_id")
      .notNull()
      .references(() => feedDrafts.id, { onDelete: "cascade" }),
    locale: locale("locale").notNull(),
    /** Nullable while drafting; required to apply. */
    title: text("title"),
    excerpt: text("excerpt"),
    description: text("description"),
    content: text("content"),
    ...timestamps,
  },
  (table) => [primaryKey({ columns: [table.draftId, table.locale] })]
);

export const FEED_DRAFT_AUTHOR = {
  Operator: "operator",
  Agent: "agent",
} as const;

export type FeedDraftAuthor =
  (typeof FEED_DRAFT_AUTHOR)[keyof typeof FEED_DRAFT_AUTHOR];

/** Which fields one revision touched; `locale` is absent for feed-level fields. */
export interface FeedDraftChange {
  locale?: Locale;
  fields: string[];
}

export interface FeedDraftTranslationSnapshot {
  title: string | null;
  excerpt: string | null;
  description: string | null;
  content: string | null;
}

/** The editable half of a draft, as stored on a revision and restored from it. */
export interface FeedDraftSnapshot {
  slug: string | null;
  type: FeedType;
  defaultLocale: Locale;
  mainImage: string | null;
  translations: Partial<Record<Locale, FeedDraftTranslationSnapshot>>;
}

export const FEED_DRAFT_REVISION_KIND = {
  /** A version the operator applied to the post. Listed as the draft's history, never pruned. */
  Commit: "commit",
  /** A restore point the write path keeps by itself; pruned unless pinned. */
  Safety: "safety",
} as const;

export type FeedDraftRevisionKind =
  (typeof FEED_DRAFT_REVISION_KIND)[keyof typeof FEED_DRAFT_REVISION_KIND];

/**
 * Immutable snapshots of a draft. Between two consecutive rows only one writer wrote, the
 * later row's `author`, which is what lets the agent and the lesson loop read operator edits
 * off the trail.
 */
export const feedDraftRevisions = pgTable(
  "feed_draft_revision",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    draftId: integer("draft_id")
      .notNull()
      .references(() => feedDrafts.id, { onDelete: "cascade" }),
    kind: text("kind").$type<FeedDraftRevisionKind>().notNull(),
    /** `feed_draft.revision` of the state in `snapshot`. */
    revision: integer("revision").notNull(),
    /** Who last wrote that state. */
    author: text("author").$type<FeedDraftAuthor>().notNull(),
    /** The writing session behind an `agent` state. */
    sessionId: text("session_id"),
    message: text("message"),
    /** Keeps a safety point out of pruning. */
    pinned: boolean("pinned").notNull().default(false),
    /** Fields that differ from the row before this one. */
    changes: jsonb("changes").$type<FeedDraftChange[]>().notNull().default([]),
    snapshot: jsonb("snapshot").$type<FeedDraftSnapshot>().notNull(),
    /** `hashFeedDraftSnapshot` of `snapshot`. */
    contentHash: text("content_hash").notNull(),
    ...timestamps,
  },
  (table) => [
    index("feed_draft_revision_draft_revision_idx").on(
      table.draftId,
      table.revision
    ),
  ]
);

export const feedsToTags = pgTable(
  "feeds_to_tags",
  {
    feedId: integer("feed_id")
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.feedId, t.tagId] }),
    index("feeds_to_tags_tag_id_idx").on(t.tagId),
  ]
);

export const FEED_REPORT_CATEGORY = {
  /** A claim the post gets wrong. */
  Error: "error",
  /** Right when written, no longer current. */
  Outdated: "outdated",
  Typo: "typo",
  /** A link, image or code sample that does not work. */
  Broken: "broken",
  /** Something the post should cover and does not. */
  Gap: "gap",
} as const;

export type FeedReportCategory =
  (typeof FEED_REPORT_CATEGORY)[keyof typeof FEED_REPORT_CATEGORY];

export const FEED_REPORT_STATUS = {
  Open: "open",
} as const;

export type FeedReportStatus =
  (typeof FEED_REPORT_STATUS)[keyof typeof FEED_REPORT_STATUS];

/**
 * A reader's correction to a published post, filed by the public agent for the operator.
 * Every text column is reader-supplied or model-written and is quoted, never followed.
 */
export const feedReports = pgTable(
  "feed_report",
  {
    id: serial("id").primaryKey(),
    feedId: integer("feed_id")
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),
    locale: locale("locale").notNull(),
    /** Heading trail as the post's sections are addressed, e.g. `"Setup > Install"`. */
    headingPath: text("heading_path"),
    /** The passage the report is about, as it read when reported. */
    quote: text("quote"),
    category: text("category").$type<FeedReportCategory>().notNull(),
    /** What the reader says is wrong or missing. */
    claim: text("claim").notNull(),
    /** What the public agent found when it checked the claim; not authoritative. */
    assessment: text("assessment").notNull(),
    /** The corrected wording as the reader or the agent proposed it; a candidate for the operator, never applied as is. */
    suggestion: text("suggestion"),
    reporterId: text("reporter_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** The public session it was filed from; kept as text so the report outlives it. */
    sessionId: text("session_id"),
    status: text("status")
      .$type<FeedReportStatus>()
      .notNull()
      .default(FEED_REPORT_STATUS.Open),
    ...timestamps,
  },
  (table) => [
    index("feed_report_status_created_at_idx").on(
      table.status,
      table.createdAt
    ),
    index("feed_report_feed_id_idx").on(table.feedId),
    index("feed_report_reporter_created_at_idx").on(
      table.reporterId,
      table.createdAt
    ),
  ]
);

export type Feed = InferSelectModel<typeof feeds>;
export type FeedTranslation = InferSelectModel<typeof feedTranslations>;
export type FeedDraft = InferSelectModel<typeof feedDrafts>;
export type FeedDraftTranslation = InferSelectModel<
  typeof feedDraftTranslations
>;
export type FeedDraftRevision = InferSelectModel<typeof feedDraftRevisions>;
export type FeedReport = InferSelectModel<typeof feedReports>;
export type Tag = InferSelectModel<typeof tags>;
export type TagTranslation = InferSelectModel<typeof tagTranslations>;
