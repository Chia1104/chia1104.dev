/**
 * `@chia/agent-writing` — the blog authoring agent.
 *
 * The *domain* half of the agent: tools, prompts, the draft staging buffer, and the policy that
 * classifies and gates them. The concrete Pi turn, provider/model construction, session
 * persistence, approval gate and wire events live in `@chia/agent-runtime`.
 *
 * Adding another agent kind means adding a sibling domain package like this one.
 */

import type {
  ContentToolContext,
  PostFeedType,
} from "@chia/agent-content/types";
import type { AgentTool } from "@chia/agent-runtime/types";
import type { ContentType, Locale } from "@chia/db/types";

import type { ContentPort, DraftStore, WebPort } from "./ports.ts";

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
  /** The read port plus the writing agent's write access. */
  content: ContentPort;
  /** Outbound web: search and page fetch. Only the writing agent gets this. */
  web: WebPort;
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

// ============================================
// Web shapes
// ============================================

export interface FetchedPage {
  url: string;
  title?: string;
  /** Plain-text extraction. Truncated by the host implementation. */
  text: string;
}

/** Search-engine recency window; the host maps it to the provider's own filter syntax. */
export type WebSearchRecency = (typeof WEB_SEARCH_RECENCIES)[number];

export const WEB_SEARCH_RECENCIES = ["day", "week", "month", "year"] as const;

export interface WebSearchInput {
  query: string;
  limit: number;
  recency?: WebSearchRecency;
}

/** One search hit: discovery only, no page body — `fetch_url` reads what is worth reading. */
export interface WebSearchResult {
  url: string;
  title?: string;
  description?: string;
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
