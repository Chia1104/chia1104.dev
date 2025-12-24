import type { InferEnum } from "drizzle-orm";
import { pgEnum } from "drizzle-orm/pg-core";

export const roles = pgEnum("role", ["admin", "user", "root"]);
export type Role = InferEnum<typeof roles>;

export const feedType = pgEnum("feed_type", ["post", "note"]);
export type FeedType = InferEnum<typeof feedType>;

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
export type ContentType = InferEnum<typeof contentType>;

export const locale = pgEnum("locale", ["en", "zh-TW"]);
export type Locale = InferEnum<typeof locale>;

/**
 * 邀請狀態
 */
export const invitationStatus = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "rejected",
  "expired",
]);
export type InvitationStatus = InferEnum<typeof invitationStatus>;

/**
 * 組織成員角色
 */
export const memberRole = pgEnum("member_role", ["owner", "admin", "member"]);
export type MemberRole = InferEnum<typeof memberRole>;
