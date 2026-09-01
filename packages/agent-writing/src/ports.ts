import type { ContentReadPort, PostSnapshot } from "@chia/agent-content/types";
import type { Locale } from "@chia/db/types";

import type {
  CommitDraftInput,
  CommitDraftResult,
  DraftFeedMeta,
  DraftTranslation,
  FeedDraft,
  FetchedPage,
  MemoryDetail,
  MemoryHit,
  MemorySearchInput,
  MemorySummary,
  SavedMemory,
  SaveMemoryInput,
  WebSearchInput,
  WebSearchResult,
} from "./types.ts";

export type {
  CommitDraftInput,
  CommitDraftResult,
  DraftFeedMeta,
  DraftTranslation,
  FeedDraft,
  FetchedPage,
  MemoryDetail,
  MemoryHit,
  MemoryKind,
  MemorySearchInput,
  MemoryStatus,
  MemorySummary,
  SavedMemory,
  SaveMemoryInput,
  WebSearchInput,
  WebSearchRecency,
  WebSearchResult,
} from "./types.ts";

/**
 * The shared read port plus what only the writing agent may do: write the author's posts.
 * Carries no author id: the host builds this port for the configured author.
 */
export interface ContentPort extends ContentReadPort {
  commitDraft(input: CommitDraftInput): Promise<CommitDraftResult>;
  setPublished(input: {
    feedId: number;
    published: boolean;
  }): Promise<{ feedId: number; published: boolean }>;
}

/**
 * Outbound web: search and page fetch. Both cost money and are an SSRF surface, so only the
 * author's session gets this port.
 */
export interface WebPort {
  search(
    input: WebSearchInput,
    signal?: AbortSignal
  ): Promise<WebSearchResult[]>;
  fetchPage(url: string, signal?: AbortSignal): Promise<FetchedPage>;
}

/** Staging buffer for one writing session. */
export interface DraftStore {
  get(sessionId: string): Promise<FeedDraft>;
  patchFeedMeta(sessionId: string, patch: DraftFeedMeta): Promise<FeedDraft>;
  patchTranslation(
    sessionId: string,
    locale: Locale,
    patch: DraftTranslation
  ): Promise<FeedDraft>;
  setContent(
    sessionId: string,
    locale: Locale,
    content: string
  ): Promise<FeedDraft>;
  markCommitted(sessionId: string, feedId: number): Promise<FeedDraft>;
  /** Seeds the buffer from an existing post when a session is opened to edit one. */
  seedFromPost(sessionId: string, post: PostSnapshot): Promise<FeedDraft>;
}

/**
 * Long-term memory, shared across sessions. Host implements `save`/`search` against RAG.
 * `list*` exist for the volatile context, which only holds a port.
 */
export interface MemoryPort {
  save(input: SaveMemoryInput, signal?: AbortSignal): Promise<SavedMemory>;
  search(input: MemorySearchInput, signal?: AbortSignal): Promise<MemoryHit[]>;
  get(id: number, signal?: AbortSignal): Promise<MemoryDetail | null>;
  listBySession(sessionId: string): Promise<MemorySummary[]>;
  listActiveLessons(limit: number): Promise<MemorySummary[]>;
}
