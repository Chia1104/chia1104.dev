import type { InferSelectModel } from "drizzle-orm";
import { text, timestamp, boolean, index } from "drizzle-orm/pg-core";

import { timestamps } from "../libs/common.schema.ts";

import { pgTable } from "./table.ts";
import { user } from "./user.schema.ts";

export const apikey = pgTable(
  "apikey",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    /** The key's first characters, shown so the owner can tell keys apart. */
    start: text("start"),
    /** SHA-256 of the raw key, base64url without padding. */
    keyHash: text("key_hash").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** `ApiKeyScope` values; unknown ones are ignored on read. */
    scopes: text("scopes").array().notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("apikey_user_id_idx").on(table.userId)]
);

export type ApiKey = InferSelectModel<typeof apikey>;
