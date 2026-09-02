import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  serial,
  text,
} from "drizzle-orm/pg-core";

import { softDelete, timestamps } from "../libs/common.schema.ts";
import type { ProfileEntryData } from "../libs/validator/profile.ts";
import type { ProfileEntryKind } from "../types.ts";

import { pgTable } from "./table.ts";
import { user } from "./user.schema.ts";

/**
 * One résumé item. Columns are what a list filters and orders by; everything a
 * kind renders lives in `data`, whose shape is `profileEntryContentSchema` for that kind.
 * A shape change is a backfill of stored rows, not a reader fallback.
 */
export const profileEntries = pgTable(
  "profile_entry",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").$type<ProfileEntryKind>().notNull(),
    published: boolean("published").notNull().default(false),
    /** Ascending within a kind; ties break on id. */
    sortOrder: integer("sort_order").notNull().default(0),
    data: jsonb("data").$type<ProfileEntryData>().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index("profile_entry_user_kind_sort_idx").on(
      table.userId,
      table.kind,
      table.sortOrder
    ),
  ]
);

export type ProfileEntry = InferSelectModel<typeof profileEntries>;
