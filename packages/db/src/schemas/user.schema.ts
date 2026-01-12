import type { InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { boolean, text, index, timestamp } from "drizzle-orm/pg-core";
import crypto from "node:crypto";

import { timestamps } from "../libs/common.schema";
import { Role } from "../types";
import { apikey } from "./apikey.schema";
import { session } from "./auth.schema";
import { account } from "./auth.schema";
import { passkey } from "./auth.schema";
import { feeds } from "./contents.schema";
import { assets } from "./contents.schema";
import { roles } from "./enums";
import { member } from "./organization.schema";
import { invitation } from "./organization.schema";
import { pgTable } from "./table";

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

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  passkeys: many(passkey),
  apikeys: many(apikey),
  members: many(member),
  invitations: many(invitation),
  feeds: many(feeds),
  assets: many(assets),
}));

export type User = InferSelectModel<typeof user>;
