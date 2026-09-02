import type { InferSelectModel } from "drizzle-orm";
import { text, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";

import { timestamps } from "../libs/common.schema.ts";

import { pgTable } from "./table.ts";

export const apikey = pgTable(
  "apikey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    start: text("start"),
    prefix: text("prefix"),
    key: text("key").notNull(),
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: timestamp("last_refill_at", { withTimezone: true }),
    rateLimitEnabled: boolean("rate_limit_enabled").default(false),
    rateLimitTimeWindow: integer("rate_limit_time_window").default(86400000),
    rateLimitMax: integer("rate_limit_max").default(10),
    requestCount: integer("request_count").default(0),
    remaining: integer("remaining"),
    lastRequest: timestamp("last_request", { withTimezone: true }),
    enabled: boolean("enabled").default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
    permissions: text("permissions"),
    metadata: text("metadata"),
    configId: text("config_id").default("default").notNull(),
    referenceId: text("reference_id").notNull(),
  },
  (table) => [
    index("apikey_key_idx").on(table.key),
    index("apikey_configId_idx").on(table.configId),
    index("apikey_referenceId_idx").on(table.referenceId),
  ]
);

export type ApiKey = InferSelectModel<typeof apikey>;
