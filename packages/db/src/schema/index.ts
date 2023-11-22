import {
  timestamp,
  text,
  primaryKey,
  integer,
  serial,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccount } from "@auth/core/adapters";
import { pgTable } from "./table";
import { roles, feed_type } from "./enums";
import { type InferSelectModel, relations, sql } from "drizzle-orm";

export const users = pgTable("user", {
  id: text("id").notNull().primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
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
    compoundKey: primaryKey(account.provider, account.providerAccountId),
  })
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").notNull().primaryKey(),
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
    compoundKey: primaryKey(vt.identifier, vt.token),
  })
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
  (table) => {
    return {
      idIndex: uniqueIndex("asset_id_index").on(table.id),
    };
  }
);

export const feeds = pgTable(
  "feed",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    type: feed_type("type").notNull(),
    title: text("title").notNull(),
    expert: text("expert"),
    description: text("description"),
    createdAt: timestamp("created_at", { mode: "date" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    readTime: integer("readTime"),
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

export const posts = pgTable(
  "post",
  {
    id: serial("id").primaryKey(),
    feedId: integer("feedId")
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),
    content: text("content"),
  },
  (table) => {
    return {
      idIndex: uniqueIndex("post_id_index").on(table.id),
    };
  }
);

export const notes = pgTable(
  "note",
  {
    id: serial("id").primaryKey(),
    feedId: integer("feedId")
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),
    content: text("content"),
  },
  (table) => {
    return {
      idIndex: uniqueIndex("note_id_index").on(table.id),
    };
  }
);

export const usersRelations = relations(users, ({ many }) => ({
  feeds: many(feeds),
  assets: many(assets),
}));

export const feedsRelations = relations(feeds, ({ one }) => ({
  post: one(posts),
  note: one(notes),
  user: one(users, {
    fields: [feeds.userId],
    references: [users.id],
  }),
}));

export const assetsRelations = relations(assets, ({ one }) => ({
  user: one(users, {
    fields: [assets.userId],
    references: [users.id],
  }),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  feed: one(feeds, {
    fields: [posts.feedId],
    references: [feeds.id],
  }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  feeds: one(feeds, {
    fields: [notes.feedId],
    references: [feeds.id],
  }),
}));

export type User = InferSelectModel<typeof users>;
export type Account = InferSelectModel<typeof accounts>;
export type Session = InferSelectModel<typeof sessions>;
export type VerificationToken = InferSelectModel<typeof verificationTokens>;
export type Asset = InferSelectModel<typeof assets>;
export type Feed = InferSelectModel<typeof feeds>;
export type Post = InferSelectModel<typeof posts>;
export type Note = InferSelectModel<typeof notes>;
