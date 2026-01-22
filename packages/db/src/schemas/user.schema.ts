import type { InferSelectModel } from "drizzle-orm";
import { boolean, text, index, timestamp } from "drizzle-orm/pg-core";

import { timestamps } from "../libs/common.schema.ts";
import { Role } from "../types.ts";
import { roles } from "./enums.ts";
import { pgTable } from "./table.ts";

export const user = pgTable(
  "user",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    email: text("email").unique().notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    role: roles("role").default(Role.User).notNull(),
    ...timestamps,
    banned: boolean("banned").default(false).notNull(),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires"),
  },
  (table) => [index("user_email_idx").on(table.email)]
);

export type User = InferSelectModel<typeof user>;
