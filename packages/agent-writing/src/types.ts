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
import type { AgentMemoryKind, AgentMemoryStatus } from "@chia/db/schema";
import type { ContentType, Locale } from "@chia/db/types";

import type { ContentPort, DraftStore, MemoryPort, WebPort } from "./ports.ts";

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
 * - `draft`  — reversible writes the blog never sees: the staging buffer, the agent's memory.
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
  /** Long-term memory across sessions: sources read, facts verified, lessons learned. */
  memory: MemoryPort;
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
  /** Main content as markdown. The tool truncates it for the model. */
  text: string;
}

/** Search-engine recency window; the host maps it to the provider's own filter syntax. */
export type WebSearchRecency = (typeof WEB_SEARCH_RECENCIES)[number];

export const WEB_SEARCH_RECENCIES = ["day", "week", "month", "year"] as const;

export interface WebSearchInput {
  query: string;
  limit: number;
  recency?: WebSearchRecency;
  /** Bare hostnames to restrict results to, without protocol or path. */
  includeDomains?: string[];
}

/** One search hit: discovery only, no page body — `fetch_url` reads what is worth reading. */
export interface WebSearchResult {
  url: string;
  title?: string;
  description?: string;
}

// ============================================
// Memory shapes
// ============================================

export type MemoryKind = AgentMemoryKind;
export type MemoryStatus = AgentMemoryStatus;

export interface SaveMemoryInput {
  kind: MemoryKind;
  title: string;
  /** Markdown. */
  content: string;
  sourceUrl?: string;
}

/** The identity of a memory: enough for a list, a citation or a `get_memory` call. */
export interface MemorySummary {
  id: number;
  kind: MemoryKind;
  title: string;
  sourceUrl: string | null;
}

export interface SavedMemory extends MemorySummary {
  /** False when a `source` revisit found the stored page unchanged. */
  changed: boolean;
}

export interface MemorySearchInput {
  query: string;
  limit: number;
}

export interface MemoryHit extends MemorySummary {
  /** The best-matching chunk's text, so the model sees why it matched. */
  snippet: string;
  /** Heading trail of the matched chunk, e.g. `"Setup > Install"`; null for a card hit. */
  headingPath: string | null;
}

export interface MemoryDetail extends MemorySummary {
  status: MemoryStatus;
  content: string;
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
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
