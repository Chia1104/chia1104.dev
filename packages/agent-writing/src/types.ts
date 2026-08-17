import type { ContentToolContext, PostFeedType } from "@chia/agent-content";
import type { AgentTool } from "@chia/agent-runtime";
import type { ContentType, Locale } from "@chia/db/types";

import type { ContentPort, DraftStore } from "./ports.ts";

/**
 * The writing agent's domain vocabulary.
 *
 * `@chia/agent-runtime` keeps tiers as plain strings because they are per-kind policy; this is where
 * the writing agent narrows them.
 */

/**
 * Tool tiers, in increasing order of blast radius.
 *
 * - `read`   — pure reads and outbound fetches. Nothing observable changes.
 * - `draft`  — writes to the staging buffer only. Reversible, invisible to the blog.
 * - `commit` — writes to `feed`/`feed_translation`/`content`. Requires approval.
 */
export type WritingToolTier = (typeof WRITING_TOOL_TIERS)[number];

export const WRITING_TOOL_TIERS = ["read", "draft", "commit"] as const;

/** Only `commit` touches published data. */
export const WRITING_APPROVAL_TIERS: readonly WritingToolTier[] = ["commit"];

/** Tiers whose successful calls mean the client should refetch the draft. */
export const WRITING_STATE_TIERS: readonly WritingToolTier[] = [
  "draft",
  "commit",
];

/**
 * Per-turn context handed to every tool by Pi's `AgentHarness`.
 *
 * Deliberately holds ports rather than a `DB` handle: the tools are this package's domain logic and
 * stay testable without a database, while `apps/service` owns the wiring.
 */
export interface WritingToolContext extends ContentToolContext {
  /** Agent session this turn belongs to. Scopes the draft buffer and the audit trail. */
  agentSessionId: string;
  /** Set when the session was opened from an existing post. */
  targetFeedId?: number;
  /** The read port plus the writing agent's own fetch and write access. */
  content: ContentPort;
  draft: DraftStore;
}

export type WritingTool = AgentTool<WritingToolContext>;

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

export interface FetchedPage {
  url: string;
  title?: string;
  /** Plain-text extraction. Truncated by the host implementation. */
  text: string;
}

export interface CommitDraftInput {
  feedId?: number;
  feedMeta: DraftFeedMeta;
  translations: Partial<Record<Locale, DraftTranslation>>;
}

export interface CommitDraftResult {
  feedId: number;
  slug: string;
  created: boolean;
}
