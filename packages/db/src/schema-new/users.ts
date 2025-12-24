import type { InferSelectModel } from "drizzle-orm";
import { boolean, text, index, timestamp } from "drizzle-orm/pg-core";
import crypto from "node:crypto";

import { Role } from "../types";
import { timestamps } from "./common";
import { roles } from "./enums";
import { pgTable } from "./table";

export const users = pgTable(
  "user",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    email: text("email").unique().notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    role: roles("role").default(Role.User).notNull(),
    ...timestamps,
    banned: boolean("banned").default(false).notNull(),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires"),
  },
  (table) => [
    index("user_email_index").on(table.email),
    index("user_role_index").on(table.role),
  ]
);

export type User = InferSelectModel<typeof users>;
