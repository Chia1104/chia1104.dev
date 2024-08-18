import type { AdapterAccount } from "@auth/core/adapters";
import { relations, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import {
  timestamp,
  text,
  primaryKey,
  integer,
  serial,
  index,
  uniqueIndex,
  boolean,
} from "drizzle-orm/pg-core";

import { ContentType } from "../types";
import { roles, feed_type, content_type } from "./enums";
import { pgTable } from "./table";

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  role: roles("role").default("user").notNull(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

export const authenticators = pgTable(
  "authenticator",
  {
    credentialID: text("credentialID").notNull().unique(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("providerAccountId").notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credentialDeviceType").notNull(),
    credentialBackedUp: boolean("credentialBackedUp").notNull(),
    transports: text("transports"),
  },
  (authenticator) => ({
    compositePK: primaryKey({
      columns: [authenticator.userId, authenticator.credentialID],
    }),
  })
);

export const tags = pgTable(
  "tag",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
  },
  (table) => {
    return {
      idIndex: uniqueIndex("tag_id_index").on(table.id),
      slugIndex: uniqueIndex("tag_slug_index").on(table.slug),
      nameIndex: index("tag_name_index").on(table.name),
    };
  }
);

export const tagsRelation = relations(tags, ({ many }) => ({
  assetsToTags: many(assetsToTags),
  feedsToTags: many(feedsToTags),
}));

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
  (table) => {
    return {
      idIndex: uniqueIndex("asset_id_index").on(table.id),
    };
  }
);

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
  (t) => ({
    pk: primaryKey({
      columns: [t.assetId, t.tagId],
    }),
  })
);

export const feeds = pgTable(
  "feed",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    readTime: integer("readTime"),
    type: feed_type("type").notNull(),
    contentType: content_type("contentType").notNull().default(ContentType.Mdx),
    published: boolean("published").default(false),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    description: text("description"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    userId: text("userId")
      .notNull()
      .references(() => users.id),
  },
  (table) => {
    return {
      idIndex: uniqueIndex("feed_id_index").on(table.id),
      slugIndex: uniqueIndex("feed_slug_index").on(table.slug),
      titleIndex: index("feed_title_index").on(table.title),
    };
  }
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
  (t) => ({
    pk: primaryKey({
      columns: [t.feedId, t.tagId],
    }),
  })
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

export const usersRelations = relations(users, ({ many }) => ({
  feeds: many(feeds),
  assets: many(assets),
}));

export const feedsRelations = relations(feeds, ({ one, many }) => ({
  content: one(contents),
  user: one(users, {
    fields: [feeds.userId],
    references: [users.id],
  }),
  feedsToTags: many(feedsToTags),
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

export type User = InferSelectModel<typeof users>;
export type Account = InferSelectModel<typeof accounts>;
export type Session = InferSelectModel<typeof sessions>;
export type VerificationToken = InferSelectModel<typeof verificationTokens>;
export type Authenticator = InferSelectModel<typeof authenticators>;
export type Asset = InferSelectModel<typeof assets>;
export type Feed = InferSelectModel<typeof feeds>;
export type Content = InferSelectModel<typeof contents>;
export type Tag = InferSelectModel<typeof tags>;
