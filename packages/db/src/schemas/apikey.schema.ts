import type { InferSelectModel } from "drizzle-orm";
import { text, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";

import { timestamps } from "../libs/common.schema.ts";

import { project } from "./organization.schema.ts";
import { pgTable } from "./table.ts";
import { user } from "./user.schema.ts";

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
      .references(() => user.id, { onDelete: "cascade" }),
    // Rate limiting - refill
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: timestamp("last_refill_at"),
    // Rate limiting - request
    rateLimitEnabled: boolean("rate_limit_enabled").default(false),
    rateLimitTimeWindow: integer("rate_limit_time_window").default(86400000),
    rateLimitMax: integer("rate_limit_max").default(10),
    // Usage tracking
    requestCount: integer("request_count").default(0),
    remaining: integer("remaining"),
    lastRequest: timestamp("last_request"),
    // Status
    enabled: boolean("enabled").default(true),
    expiresAt: timestamp("expires_at"),
    ...timestamps,
    // Metadata
    permissions: text("permissions"),
    metadata: text("metadata"),
    // Project relation
    projectId: integer("project_id").references(() => project.id, {
      onDelete: "cascade",
    }),
  },
  (table) => [
    index("apikey_user_id_idx").on(table.userId),
    index("apikey_key_idx").on(table.key),
    index("apikey_project_id_idx").on(table.projectId),
  ]
);

export type ApiKey = InferSelectModel<typeof apikey>;
