import { relations, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import {
  timestamp,
  text,
  primaryKey,
  integer,
  serial,
  index,
  uniqueIndex, // boolean,
} from "drizzle-orm/pg-core";

import {
  /**
   * @TODO: Uncomment when we support pgvector
   */
  // feedsWithEmbeddingColumns,
  // feedsWithEmbeddingExtraConfig,
  baseFeedsColumns,
  baseFeedsExtraConfig,
} from "../libs/schema-columns";
import { roles, i18n } from "./enums";
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
    type: text("type"),
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
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ]
);

/**
 * @deprecated get sessions from Redis
 */
export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const betterSession = pgTable("better_session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
});

export const betterAccount = pgTable("better_account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// export const authenticators = pgTable(
//   "authenticator",
//   {
//     credentialID: text("credentialID").notNull().unique(),
//     userId: text("userId")
//       .notNull()
//       .references(() => users.id, { onDelete: "cascade" }),
//     providerAccountId: text("providerAccountId").notNull(),
//     credentialPublicKey: text("credentialPublicKey").notNull(),
//     counter: integer("counter").notNull(),
//     credentialDeviceType: text("credentialDeviceType").notNull(),
//     credentialBackedUp: boolean("credentialBackedUp").notNull(),
//     transports: text("transports"),
//   },
//   (authenticator) => ({
//     compositePK: primaryKey({
//       columns: [authenticator.userId, authenticator.credentialID],
//     }),
//   })
// );

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
  (table) => [uniqueIndex("asset_id_index").on(table.id)]
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
  (t) => [
    primaryKey({
      columns: [t.assetId, t.tagId],
    }),
  ]
);

export const feeds = pgTable("feed", baseFeedsColumns, baseFeedsExtraConfig);

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

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

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

// export const authenticatorsRelations = relations(authenticators, ({ one }) => ({
//   user: one(users, {
//     fields: [authenticators.userId],
//     references: [users.id],
//   }),
// }));

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

export type User = InferSelectModel<typeof users>;
export type Account = InferSelectModel<typeof accounts>;
export type Session = InferSelectModel<typeof sessions>;
export type VerificationToken = InferSelectModel<typeof verificationTokens>;
// export type Authenticator = InferSelectModel<typeof authenticators>;
export type Asset = InferSelectModel<typeof assets>;
export type Feed = InferSelectModel<typeof feeds>;
export type Content = InferSelectModel<typeof contents>;
export type Tag = InferSelectModel<typeof tags>;
export type FeedMeta = InferSelectModel<typeof feedMeta>;
export type Verification = InferSelectModel<typeof verification>;
export type BetterSession = InferSelectModel<typeof betterSession>;
export type BetterAccount = InferSelectModel<typeof betterAccount>;
