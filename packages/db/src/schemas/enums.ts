import type { InferEnum } from "drizzle-orm";
import { pgEnum } from "drizzle-orm/pg-core";

export const feedType = pgEnum("feed_type", [
  "post",
  "note",
  "guide",
  "review",
  "journal",
]);
export type FeedType = InferEnum<typeof feedType>;

export const locale = pgEnum("locale", ["en", "zh-TW"]);
export type Locale = InferEnum<typeof locale>;
