import { pgEnum } from "drizzle-orm/pg-core";

export const roles = pgEnum("role", ["admin", "user", "root"]);

export const feedType = pgEnum("feed_type", ["post", "note"]);

export const contentType = pgEnum("content_type", [
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

export const i18n = pgEnum("i18n", ["en", "zh-tw"]);

/**
 * 邀請狀態
 */
export const invitationStatus = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "rejected",
  "expired",
]);

/**
 * 組織成員角色
 */
export const memberRole = pgEnum("member_role", ["owner", "admin", "member"]);
