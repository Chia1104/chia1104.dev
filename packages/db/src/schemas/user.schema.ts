import type { InferSelectModel } from "drizzle-orm";
import { boolean, text, index, timestamp } from "drizzle-orm/pg-core";

import { timestamps } from "../libs/common.schema.ts";

import { pgTable } from "./table.ts";

export const user = pgTable(
  "user",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    /** A verified address from the OAuth provider; `null` for a guest. */
    email: text("email").unique(),
    image: text("image"),
    /** Guest who passed the captcha but never signed in. */
    isAnonymous: boolean("is_anonymous").default(false).notNull(),
    ...timestamps,
    banned: boolean("banned").default(false).notNull(),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires", { withTimezone: true }),
  },
  (table) => [index("user_email_idx").on(table.email)]
);

export type User = InferSelectModel<typeof user>;
