import { relations, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import {
  feedsWithEmbeddingColumns,
  feedsWithEmbeddingExtraConfig,
} from "../libs/schema-columns";
import { i18n } from "./enums";
import { pgTable } from "./table";
import { users } from "./users";

export const tags = pgTable(
  "tag",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
  },
  (table) => [
    uniqueIndex("tag_id_index").on(table.id),
    uniqueIndex("tag_slug_index").on(table.slug),
    index("tag_name_index").on(table.name),
  ]
);

export const assets = pgTable(
  "asset",
  {
    id: serial("id").primaryKey(),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    name: text("name").notNull(),
    extention: text("extention"),
    url: text("url").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => users.id),
  },
  (table) => [uniqueIndex("asset_id_index").on(table.id)]
);

export const feeds = pgTable(
  "feed",
  feedsWithEmbeddingColumns,
  feedsWithEmbeddingExtraConfig
);

export const contents = pgTable("content", {
  id: serial("id").primaryKey(),
  feedId: integer("feedId")
    .notNull()
    .references(() => feeds.id, { onDelete: "cascade" }),
  content: text("content"),
  source: text("source"),
  unstable_serializedSource: text("unstable_serializedSource"),
});

export const feedMeta = pgTable("feed_meta", {
  id: serial("id").primaryKey(),
  feedId: integer("feedId")
    .notNull()
    .references(() => feeds.id, { onDelete: "cascade" }),
  mainI18n: i18n("mainI18n"),
  mainImage: text("mainImage"),
  summary: text("summary"),
});

export const assetsToTags = pgTable(
  "assets_to_tags",
  {
    assetId: integer("assetId")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    tagId: integer("tagId")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({
      columns: [t.assetId, t.tagId],
    }),
  ]
);

export const feedsToTags = pgTable(
  "feeds_to_tags",
  {
    feedId: integer("feedId")
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),
    tagId: integer("tagId")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({
      columns: [t.feedId, t.tagId],
    }),
  ]
);

export const tagsRelation = relations(tags, ({ many }) => ({
  assetsToTags: many(assetsToTags),
  feedsToTags: many(feedsToTags),
}));

export const usersRelations = relations(users, ({ many }) => ({
  feeds: many(feeds),
  assets: many(assets),
}));

export const feedsRelations = relations(feeds, ({ one, many }) => ({
  content: one(contents, {
    fields: [feeds.id],
    references: [contents.feedId],
  }),
  user: one(users, {
    fields: [feeds.userId],
    references: [users.id],
  }),
  feedsToTags: many(feedsToTags),
  feedMeta: one(feedMeta, {
    fields: [feeds.id],
    references: [feedMeta.feedId],
  }),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  user: one(users, {
    fields: [assets.userId],
    references: [users.id],
  }),
  assetsToTags: many(assetsToTags),
}));

export const contentsRelations = relations(contents, ({ one }) => ({
  feed: one(feeds, {
    fields: [contents.feedId],
    references: [feeds.id],
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

export const feedMetaRelations = relations(feedMeta, ({ one }) => ({
  feed: one(feeds, {
    fields: [feedMeta.feedId],
    references: [feeds.id],
  }),
}));

export type Asset = InferSelectModel<typeof assets>;
export type Feed = InferSelectModel<typeof feeds>;
export type Content = InferSelectModel<typeof contents>;
export type Tag = InferSelectModel<typeof tags>;
export type FeedMeta = InferSelectModel<typeof feedMeta>;
