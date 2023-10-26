import { timestamp, text, primaryKey, integer } from "drizzle-orm/pg-core";
import type { AdapterAccount } from "@auth/core/adapters";
import { pgTable } from "./table";
import { roles } from "./enums";
import { InferSelectModel } from "drizzle-orm";

export const users = pgTable("user", {
  id: text("id").notNull().primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  role: roles("role").notNull(),
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

export const asset = pgTable("asset", {
  id: text("id").notNull().primaryKey(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull(),
  name: text("name").notNull(),
  extention: text("extention"),
  url: text("url").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
});

export const feed = pgTable("feed", {
  id: text("id").notNull().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull(),
  readTime: integer("readTime"),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  image: text("assetId")
    .notNull()
    .references(() => asset.id),
});

export const post = pgTable("post", {
  id: text("id").notNull().primaryKey(),
  feedId: text("feedId")
    .notNull()
    .references(() => feed.id, { onDelete: "cascade" }),
  content: text("content"),
  expert: text("expert"),
});

export type User = InferSelectModel<typeof users>;
export type Account = InferSelectModel<typeof accounts>;
export type Session = InferSelectModel<typeof sessions>;
export type VerificationToken = InferSelectModel<typeof verificationTokens>;
export type Asset = InferSelectModel<typeof asset>;
export type Feed = InferSelectModel<typeof feed>;
export type Post = InferSelectModel<typeof post>;
