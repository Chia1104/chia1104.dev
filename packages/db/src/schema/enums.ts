import { pgEnum } from "drizzle-orm/pg-core";

export const roles = pgEnum("role", ["admin", "user"]);

export const feed_type = pgEnum("feed_type", ["post", "note"]);
