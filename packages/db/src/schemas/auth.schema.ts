import type { InferSelectModel } from "drizzle-orm";
import { text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

import { timestamps } from "../libs/common.schema.ts";

import { pgTable } from "./table.ts";
import { user } from "./user.schema.ts";

export const session = pgTable(
  "session",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** SHA-256 of the cookie value; the raw token is never stored. */
    tokenHash: text("token_hash").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (table) => [index("session_user_id_idx").on(table.userId)]
);

/** One OAuth identity linked to a user. */
export const account = pgTable(
  "account",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    providerId: text("provider_id").notNull(),
    /** The provider's own user id. */
    accountId: text("account_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_provider_account_idx").on(
      table.providerId,
      table.accountId
    ),
  ]
);

export type Session = InferSelectModel<typeof session>;
export type Account = InferSelectModel<typeof account>;
