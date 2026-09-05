import type { InferSelectModel } from "drizzle-orm";
import {
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

export const tags = pgTable(
  "tag",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    ...timestamps,
  },
  (table) => [uniqueIndex("tag_slug_idx").on(table.slug)]
);

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
    index("tag_translation_tag_id_idx").on(table.tagId),
    index("tag_translation_locale_idx").on(table.locale),
    index("tag_translation_name_idx").on(table.name),
  ]
);

export const assets = pgTable(
  "asset",
  {
    id: serial("id").primaryKey(),
    ...timestamps,
    name: text("name").notNull(),
    extension: text("extension"),
    url: text("url").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("asset_user_id_idx").on(table.userId),
    index("asset_name_idx").on(table.name),
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
 * only changes when a draft is applied, so draft writes never start feed indexing. `revision`
 * is the compare-and-set counter every write must present.
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
    revision: integer("revision").notNull().default(1),
    /** The revision last applied to `feed`; `null` when never applied. */
    appliedRevision: integer("applied_revision"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("feed_draft_feed_id_idx").on(table.feedId),
    index("feed_draft_user_id_idx").on(table.userId),
    index("feed_draft_updated_at_idx").on(table.updatedAt),
  ]
);

/** Per-locale draft fields; mirrors `feed_translation` minus the indexer-owned `read_time`. */
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
    summary: text("summary"),
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
  summary: string | null;
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

/**
 * Restore points and the change trail the agent reads to learn what the operator edited.
 * Consecutive operator saves coalesce into one row; the table is capped per draft.
 */
export const feedDraftRevisions = pgTable(
  "feed_draft_revision",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    draftId: integer("draft_id")
      .notNull()
      .references(() => feedDrafts.id, { onDelete: "cascade" }),
    /** `feed_draft.revision` after this write. */
    revision: integer("revision").notNull(),
    author: text("author").$type<FeedDraftAuthor>().notNull(),
    /** The writing session that made an `agent` revision. */
    sessionId: text("session_id"),
    changes: jsonb("changes").$type<FeedDraftChange[]>().notNull().default([]),
    /** The whole draft after this write, so restore is a replace. */
    snapshot: jsonb("snapshot").$type<FeedDraftSnapshot>().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("feed_draft_revision_draft_revision_idx").on(
      table.draftId,
      table.revision
    ),
  ]
);

export const assetsToTags = pgTable(
  "assets_to_tags",
  {
    assetId: integer("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.assetId, t.tagId] }),
    index("assets_to_tags_asset_id_idx").on(t.assetId),
    index("assets_to_tags_tag_id_idx").on(t.tagId),
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
    index("feeds_to_tags_feed_id_idx").on(t.feedId),
    index("feeds_to_tags_tag_id_idx").on(t.tagId),
  ]
);

export type Asset = InferSelectModel<typeof assets>;
export type Feed = InferSelectModel<typeof feeds>;
export type FeedTranslation = InferSelectModel<typeof feedTranslations>;
export type FeedDraft = InferSelectModel<typeof feedDrafts>;
export type FeedDraftTranslation = InferSelectModel<
  typeof feedDraftTranslations
>;
export type FeedDraftRevision = InferSelectModel<typeof feedDraftRevisions>;
export type Tag = InferSelectModel<typeof tags>;
export type TagTranslation = InferSelectModel<typeof tagTranslations>;
