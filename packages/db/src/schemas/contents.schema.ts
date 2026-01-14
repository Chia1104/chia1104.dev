import { relations } from "drizzle-orm";
import type { InferSelectModel, BuildExtraConfigColumns } from "drizzle-orm";
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

import { timestamps } from "../libs/common.schema.ts";
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
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  mainImage: text("main_image"),
};

type FeedsColumns = typeof baseFeedsColumns;

const feedsExtraConfig = (
  table: BuildExtraConfigColumns<"feed", FeedsColumns, "pg">
) => [
  uniqueIndex("feed_slug_idx").on(table.slug),
  index("feed_user_id_idx").on(table.userId),
  index("feed_type_idx").on(table.type),
  index("feed_published_idx").on(table.published),
  index("feed_default_locale_idx").on(table.defaultLocale),
];

export const feeds = pgTable("feed", baseFeedsColumns, feedsExtraConfig);

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
    embedding: vector("embedding", { dimensions: 1536 }),
    // Ollama embedding model: nomic-ai/nomic-embed-text-v1.5
    embedding512: vector("embedding512", { dimensions: 512 }),
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
    index("feed_translation_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
    index("feed_translation_embedding512_idx").using(
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
// Relations
// ============================================

export const tagsRelations = relations(tags, ({ many }) => ({
  translations: many(tagTranslations),
  assetsToTags: many(assetsToTags),
  feedsToTags: many(feedsToTags),
}));

export const tagTranslationsRelations = relations(
  tagTranslations,
  ({ one }) => ({
    tag: one(tags, {
      fields: [tagTranslations.tagId],
      references: [tags.id],
    }),
  })
);

export const feedsRelations = relations(feeds, ({ one, many }) => ({
  translations: many(feedTranslations),
  user: one(user, {
    fields: [feeds.userId],
    references: [user.id],
  }),
  feedsToTags: many(feedsToTags),
}));

export const feedTranslationsRelations = relations(
  feedTranslations,
  ({ one }) => ({
    feed: one(feeds, {
      fields: [feedTranslations.feedId],
      references: [feeds.id],
    }),
    content: one(contents, {
      fields: [feedTranslations.id],
      references: [contents.feedTranslationId],
    }),
  })
);

export const assetsRelations = relations(assets, ({ one, many }) => ({
  user: one(user, {
    fields: [assets.userId],
    references: [user.id],
  }),
  assetsToTags: many(assetsToTags),
}));

export const contentsRelations = relations(contents, ({ one }) => ({
  feedTranslation: one(feedTranslations, {
    fields: [contents.feedTranslationId],
    references: [feedTranslations.id],
  }),
}));

export const assetsToTagsRelations = relations(assetsToTags, ({ one }) => ({
  asset: one(assets, {
    fields: [assetsToTags.assetId],
    references: [assets.id],
  }),
  tag: one(tags, {
    fields: [assetsToTags.tagId],
    references: [tags.id],
  }),
}));

export const feedsToTagsRelations = relations(feedsToTags, ({ one }) => ({
  feed: one(feeds, {
    fields: [feedsToTags.feedId],
    references: [feeds.id],
  }),
  tag: one(tags, {
    fields: [feedsToTags.tagId],
    references: [tags.id],
  }),
}));

// ============================================
// Types
// ============================================

export type Asset = InferSelectModel<typeof assets>;
export type Feed = InferSelectModel<typeof feeds>;
export type FeedTranslation = InferSelectModel<typeof feedTranslations>;
export type Content = InferSelectModel<typeof contents>;
export type Tag = InferSelectModel<typeof tags>;
export type TagTranslation = InferSelectModel<typeof tagTranslations>;
