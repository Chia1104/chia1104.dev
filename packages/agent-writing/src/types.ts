import type {
  ContentToolContext,
  PostFeedType,
} from "@chia/agent-content/types";
import type { AgentTool } from "@chia/agent-runtime/types";
import type {
  AgentMemoryKind,
  AgentMemoryStatus,
  FeedDraftChange,
} from "@chia/db/schema";
import type { Locale } from "@chia/db/types";

import type { ContentPort, DraftStore, MemoryPort, WebPort } from "./ports.ts";

/**
 * Tool tiers, increasing blast radius:
 * - `read`: observation and outbound fetches
 * - `draft`: reversible staging the blog never sees
 * - `commit`: applies the draft to `feed` / `feed_translation` or publishes; needs approval
 */
export type WritingToolTier = (typeof WRITING_TOOL_TIERS)[number];

export const WRITING_TOOL_TIERS = ["read", "draft", "commit"] as const;

/**
 * Per-turn tool context. Ports, not a DB handle, so tools stay testable without one.
 */
export interface WritingToolContext extends ContentToolContext {
  agentSessionId: string;
  content: ContentPort;
  web: WebPort;
  draft: DraftStore;
  memory: MemoryPort;
}

export type WritingTool = AgentTool<WritingToolContext>;

/** Per-locale draft fields. Mirrors `feed_draft_translation`; `undefined` leaves a field alone, `null` clears it. */
export interface DraftTranslation {
  title?: string | null;
  excerpt?: string | null;
  description?: string | null;
  summary?: string | null;
  content?: string | null;
}

/** Feed-level draft fields. */
export interface DraftFeedMeta {
  slug?: string | null;
  type?: PostFeedType;
  defaultLocale?: Locale;
  mainImage?: string | null;
}

/** The shared working draft as the agent sees it; the same row the dashboard editor writes. */
export interface FeedDraft {
  id: number;
  /** `null` until the draft has been applied once. */
  feedId: number | null;
  /** Compare-and-set counter; every write bumps it. */
  revision: number;
  slug: string | null;
  type: PostFeedType;
  defaultLocale: Locale;
  mainImage: string | null;
  translations: Partial<Record<Locale, DraftTranslation>>;
}

/** Which fields the operator touched since the agent last looked; `locale` is absent for feed-level fields. */
export type DraftChange = FeedDraftChange;

export interface FetchedPage {
  url: string;
  title?: string;
  /** Truncated for the model. */
  text: string;
}

/** Search-engine recency window; the host maps it to the provider's filter syntax. */
export type WebSearchRecency = (typeof WEB_SEARCH_RECENCIES)[number];

export const WEB_SEARCH_RECENCIES = ["day", "week", "month", "year"] as const;

export interface WebSearchInput {
  query: string;
  limit: number;
  recency?: WebSearchRecency;
  /** Bare hostnames, without protocol or path. */
  includeDomains?: string[];
}

/** Discovery only; `fetch_url` reads the page. */
export interface WebSearchResult {
  url: string;
  title?: string;
  description?: string;
}

export type MemoryKind = AgentMemoryKind;
export type MemoryStatus = AgentMemoryStatus;

export interface SaveMemoryInput {
  kind: MemoryKind;
  title: string;
  content: string;
  sourceUrl?: string;
}

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
  snippet: string;
  /** Heading trail of the matched chunk, e.g. `"Setup > Install"`; null for a card hit. */
  headingPath: string | null;
}

export interface MemoryDetail extends MemorySummary {
  status: MemoryStatus;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommitDraftResult {
  feedId: number;
  slug: string;
  created: boolean;
}
