import type { InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  text,
  timestamp,
  integer,
  boolean,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

import { timestamps } from "./common";
import { project } from "./organization";
import { pgTable } from "./table";
import { users } from "./users";

export const apikey = pgTable(
  "apikey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    start: text("start"),
    prefix: text("prefix"),
    key: text("key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Rate limiting - refill
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: timestamp("last_refill_at"),
    // Rate limiting - request
    rateLimitEnabled: boolean("rate_limit_enabled").default(false).notNull(),
    rateLimitTimeWindow: integer("rate_limit_time_window"),
    rateLimitMax: integer("rate_limit_max"),
    // Usage tracking
    requestCount: integer("request_count").default(0).notNull(),
    remaining: integer("remaining"),
    lastRequest: timestamp("last_request"),
    // Status
    enabled: boolean("enabled").default(true).notNull(),
    expiresAt: timestamp("expires_at"),
    ...timestamps,
    // Metadata
    permissions: jsonb("permissions"),
    metadata: jsonb("metadata"),
    // Project relation
    projectId: integer("project_id").references(() => project.id, {
      onDelete: "cascade",
    }),
  },
  (table) => [
    index("apikey_user_id_index").on(table.userId),
    index("apikey_key_index").on(table.key),
    index("apikey_project_id_index").on(table.projectId),
    index("apikey_enabled_index").on(table.enabled),
  ]
);

export const apikeyRelations = relations(apikey, ({ one }) => ({
  project: one(project, {
    fields: [apikey.projectId],
    references: [project.id],
  }),
  user: one(users, {
    fields: [apikey.userId],
    references: [users.id],
  }),
}));

export type ApiKey = InferSelectModel<typeof apikey>;
