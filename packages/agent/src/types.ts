import type {
  AgentHarnessTool,
  ThinkingLevel,
} from "@earendil-works/pi-agent-core";

import type { ContentType, FeedType, Locale } from "@chia/db/types";

import type { ContentPort, DraftStore, PendingMessageStore } from "./ports.ts";

export type { ThinkingLevel };

/**
 * Tool tiers, in increasing order of blast radius. The tier is what the permission gate
 * keys on — see `permissions.ts`.
 *
 * - `read`   — pure reads and outbound fetches. Nothing observable changes.
 * - `draft`  — writes to the staging buffer only. Reversible, invisible to the blog.
 * - `commit` — writes to `feed`/`feed_translation`/`content`. Requires approval.
 */
export type ToolTier = "read" | "draft" | "commit";

export const TOOL_TIERS = ["read", "draft", "commit"] as const;

/**
 * Per-turn context handed to every tool by the harness (pi 0.82's `toolContext`).
 *
 * Deliberately holds ports rather than a `DB` handle: the tools are the domain logic of
 * this package and stay testable without a database, while `apps/service` owns the wiring.
 */
export interface WritingToolContext {
  /** Agent session this turn belongs to. Scopes the draft buffer and the audit trail. */
  agentSessionId: string;
  /** Configured admin whose posts the agent may read and write. */
  adminId: string;
  /** Set when the session was opened from an existing post. */
  targetFeedId?: number;
  content: ContentPort;
  draft: DraftStore;
  pending: PendingMessageStore;
}

export type WritingTool = AgentHarnessTool<WritingToolContext>;

// ============================================
// Draft buffer shapes
// ============================================

/** Per-locale draft fields. Mirrors `feed_translation` plus the MDX body. */
export interface DraftTranslation {
  title?: string;
  excerpt?: string | null;
  description?: string | null;
  summary?: string | null;
  content?: string;
}

/**
 * Feed-level draft fields.
 *
 * `tagSlugs` is recorded but **not** committed: there is no tag write procedure in the
 * repo yet (only read paths exist), so `commit_draft` drops it. Keeping it lets the agent
 * propose tags for a human to apply.
 */
export interface DraftFeedMeta {
  slug?: string;
  type?: PostFeedType;
  contentType?: ContentType;
  defaultLocale?: Locale;
  mainImage?: string | null;
  tagSlugs?: string[];
}

export interface FeedDraft {
  feedMeta: DraftFeedMeta;
  translations: Partial<Record<Locale, DraftTranslation>>;
  /** Set once `commit_draft` has run, so a second commit updates instead of creating. */
  committedFeedId?: number;
}

// ============================================
// Content port shapes
// ============================================

/**
 * `FeedType` includes `"all"`, which is a *filter* value rather than a storable one. A draft or a
 * real post is only ever `post` or `note`.
 */
export type PostFeedType = Exclude<FeedType, "all">;

export interface PostSearchHit {
  slug: string;
  locale: Locale;
  title: string;
  /** Matched chunk (vector search) or the indexed description (Algolia). */
  snippet: string;
  /** Heading trail of the matched chunk, as stored — e.g. `"Setup > Install"`. */
  headingPath?: string;
}

export interface PostListItem {
  feedId: number;
  slug: string;
  type: PostFeedType;
  published: boolean;
  defaultLocale: Locale;
  title: string;
  updatedAt: string;
}

export interface PostSnapshot {
  feedId: number;
  slug: string;
  type: PostFeedType;
  contentType: ContentType;
  published: boolean;
  defaultLocale: Locale;
  mainImage?: string | null;
  translations: {
    locale: Locale;
    title: string;
    excerpt?: string | null;
    description?: string | null;
    summary?: string | null;
    content?: string | null;
  }[];
  tagSlugs: string[];
}

export interface TagItem {
  slug: string;
  names: Partial<Record<Locale, string>>;
}

export interface FetchedPage {
  url: string;
  title?: string;
  /** Plain-text extraction. Truncated by the adapter. */
  text: string;
}

export interface CommitDraftInput {
  adminId: string;
  feedId?: number;
  feedMeta: DraftFeedMeta;
  translations: Partial<Record<Locale, DraftTranslation>>;
}

export interface CommitDraftResult {
  feedId: number;
  slug: string;
  created: boolean;
}

// ============================================
// Session settings
// ============================================

export interface AgentSessionSettings {
  providerId: string;
  modelId: string;
  thinkingLevel: ThinkingLevel;
  activeToolNames: string[] | null;
  autoApprove: ToolTier[];
}
