import type { InferSelectModel } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  serial,
  text,
  uniqueIndex,
  boolean,
  vector,
} from "drizzle-orm/pg-core";

import { timestamps, softDelete } from "../libs/common.schema.ts";
import { ContentType } from "../types.ts";

import { locale, feedType, contentType } from "./enums.ts";
import { pgTable } from "./table.ts";
import { user } from "./user.schema.ts";

// ============================================
// Tags
// ============================================

export const tags = pgTable(
  "tag",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    ...timestamps,
  },
  (table) => [uniqueIndex("tag_slug_idx").on(table.slug)]
);

// ============================================
// Tag Translations
// ============================================

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

// ============================================
// Assets
// ============================================

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

// ============================================
// Feeds
// ============================================

const baseFeedsColumns = {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  type: feedType("type").notNull(),
  contentType: contentType("content_type").notNull().default(ContentType.Mdx),
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

// ============================================
// Feed Translations
// ============================================

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

// ============================================
// Feed Embeddings
// ============================================

/**
 * One row per (translation, model, chunk). Keeping vectors out of
 * `feed_translation` means adding/replacing an embedding model is a data
 * backfill instead of a schema migration.
 *
 * pgvector columns have a fixed dimension, so each supported dimension gets
 * its own nullable column; `model` decides which one is populated.
 */
export const feedEmbeddings = pgTable(
  "feed_embedding",
  {
    id: serial("id").primaryKey(),
    feedTranslationId: integer("feed_translation_id")
      .notNull()
      .references(() => feedTranslations.id, { onDelete: "cascade" }),
    // embedding model name, e.g. "text-embedding-3-small", "nomic-embed-text"
    model: text("model").notNull(),
    // "document": one topic-level vector per translation (related feeds).
    // "chunk": structure-aware section vectors (search / future RAG context).
    kind: text("kind", { enum: ["document", "chunk"] })
      .notNull()
      .default("document"),
    chunkIndex: integer("chunk_index").notNull().default(0),
    chunkText: text("chunk_text"),
    // e.g. "HNSW > ef_search"; only set for chunk rows
    headingPath: text("heading_path"),
    tokenCount: integer("token_count"),
    // sha-256 of the source content; combined with indexVersion for stale detection
    contentHash: text("content_hash").notNull(),
    // preprocessing/chunking strategy version — bumping it re-embeds in place
    indexVersion: text("index_version").notNull(),
    // OpenAI embedding model: text-embedding-3-small
    embedding1536: vector("embedding_1536", { dimensions: 1536 }),
    // Ollama embedding model: nomic-ai/nomic-embed-text-v1.5
    embedding512: vector("embedding_512", { dimensions: 512 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("feed_embedding_translation_model_kind_chunk_idx").on(
      table.feedTranslationId,
      table.model,
      table.kind,
      table.chunkIndex
    ),
    index("feed_embedding_translation_id_idx").on(table.feedTranslationId),
    index("feed_embedding_model_idx").on(table.model),
    index("feed_embedding_kind_idx").on(table.kind),
    index("feed_embedding_1536_hnsw_idx").using(
      "hnsw",
      table.embedding1536.op("vector_cosine_ops")
    ),
    index("feed_embedding_512_hnsw_idx").using(
      "hnsw",
      table.embedding512.op("vector_cosine_ops")
    ),
  ]
);

// ============================================
// Contents
// ============================================

export const contents = pgTable(
  "content",
  {
    id: serial("id").primaryKey(),
    feedTranslationId: integer("feed_translation_id")
      .notNull()
      .references(() => feedTranslations.id, { onDelete: "cascade" })
      .unique(),
    content: text("content"),
    source: text("source"),
    unstableSerializedSource: text("unstable_serialized_source"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("content_feed_translation_id_idx").on(table.feedTranslationId),
  ]
);

// ============================================
// Many-to-Many Junction Tables
// ============================================

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

// ============================================
// Types
// ============================================

export type Asset = InferSelectModel<typeof assets>;
export type Feed = InferSelectModel<typeof feeds>;
export type FeedTranslation = InferSelectModel<typeof feedTranslations>;
export type FeedEmbedding = InferSelectModel<typeof feedEmbeddings>;
export type Content = InferSelectModel<typeof contents>;
export type Tag = InferSelectModel<typeof tags>;
export type TagTranslation = InferSelectModel<typeof tagTranslations>;
