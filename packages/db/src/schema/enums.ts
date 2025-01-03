import { pgEnum } from "drizzle-orm/pg-core";

export const roles = pgEnum("role", ["admin", "user"]);

export const feed_type = pgEnum("feed_type", ["post", "note"]);

export const content_type = pgEnum("content_type", [
  /**
   * @default
   */
  "mdx",
  /**
   * @todo
   */
  "notion",
  "tiptap",
  "plate",
]);

export const i18n = pgEnum("i18n", ["en", "zh-TW"]);
