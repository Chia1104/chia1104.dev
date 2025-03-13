import type { InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

import { project } from "./organization";
import { pgTable } from "./table";
import { users } from "./users";

export const apikey = pgTable("apikey", {
  id: text("id").primaryKey(),
  name: text("name"),
  start: text("start"),
  prefix: text("prefix"),
  key: text("key").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  refillInterval: integer("refill_interval"),
  refillAmount: integer("refill_amount"),
  lastRefillAt: timestamp("last_refill_at"),
  enabled: boolean("enabled"),
  rateLimitEnabled: boolean("rate_limit_enabled"),
  rateLimitTimeWindow: integer("rate_limit_time_window"),
  rateLimitMax: integer("rate_limit_max"),
  requestCount: integer("request_count"),
  remaining: integer("remaining"),
  lastRequest: timestamp("last_request"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  permissions: text("permissions"),
  metadata: text("metadata"),
  projectId: integer("project_id").references(() => project.id, {
    onDelete: "cascade",
  }),
});

export const apikeyRelations = relations(apikey, ({ one }) => ({
  project: one(project, {
    fields: [apikey.projectId],
    references: [project.id],
  }),
}));

export type ApiKey = InferSelectModel<typeof apikey>;
