import type { ContentReadPort } from "@chia/agent-content/types";
import type { Locale } from "@chia/db/types";

import type {
  CommitDraftResult,
  DraftChange,
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
  CommitDraftResult,
  DraftChange,
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
  /** Writes the shared draft onto the feed, creating an unpublished one the first time. */
  applyDraft(input: { draftId: number }): Promise<CommitDraftResult>;
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

/**
 * The session's shared working draft. Bound to one draft when constructed; every write goes
 * through the same compare-and-set row the dashboard editor uses.
 */
export interface DraftStore {
  get(): Promise<FeedDraft>;
  patchFeedMeta(patch: DraftFeedMeta): Promise<FeedDraft>;
  patchTranslation(locale: Locale, patch: DraftTranslation): Promise<FeedDraft>;
  /**
   * Replaces a locale's body. With `expectedRevision`, a draft that moved since that
   * revision rejects the write with {@link DraftConflictError} instead of overwriting it.
   */
  setContent(
    locale: Locale,
    content: string,
    expectedRevision?: number
  ): Promise<FeedDraft>;
  /** What the operator changed after `afterRevision`, merged per locale. */
  operatorChangesSince(afterRevision: number): Promise<DraftChange[]>;
  /** Highest revision this store has returned; the host records it as seen when the turn ends. */
  readonly lastObservedRevision: number;
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
