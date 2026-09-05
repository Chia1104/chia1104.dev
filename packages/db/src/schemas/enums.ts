import type { InferEnum } from "drizzle-orm";
import { pgEnum } from "drizzle-orm/pg-core";

export const roles = pgEnum("role", ["admin", "user", "root"]);
export type Role = InferEnum<typeof roles>;

export const feedType = pgEnum("feed_type", ["post", "note"]);
export type FeedType = InferEnum<typeof feedType>;

export const locale = pgEnum("locale", ["en", "zh-TW"]);
export type Locale = InferEnum<typeof locale>;
