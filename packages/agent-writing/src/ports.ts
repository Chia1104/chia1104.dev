import type { ContentReadPort } from "@chia/agent-content/types";
import type { Locale } from "@chia/db/types";

import type {
  CommitDraftResult,
  DraftChange,
  DraftFeedMeta,
  DraftTranslation,
  FeedDraft,
  FeedDraftSummary,
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
  FeedDraftSummary,
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
 * The author's shared working drafts, addressed by id. Every write goes through the same
 * compare-and-set row the dashboard editor uses. An unknown or discarded id throws
 * {@link DraftNotFoundError}.
 */
export interface DraftStore {
  /** Drafts with unapplied work, newest first. */
  list(): Promise<FeedDraftSummary[]>;
  /** A feed's working draft, created from the feed when there is none; an empty draft for a new post without `feedId`. */
  open(input: { feedId?: number }): Promise<FeedDraft>;
  get(draftId: number): Promise<FeedDraft>;
  patchFeedMeta(draftId: number, patch: DraftFeedMeta): Promise<FeedDraft>;
  patchTranslation(
    draftId: number,
    locale: Locale,
    patch: DraftTranslation
  ): Promise<FeedDraft>;
  /**
   * Replaces a locale's body. With `expectedRevision`, a draft that moved since that
   * revision rejects the write with {@link DraftConflictError} instead of overwriting it.
   */
  setContent(
    draftId: number,
    locale: Locale,
    content: string,
    expectedRevision?: number
  ): Promise<FeedDraft>;
  /** What the operator changed after `afterRevision`, merged per locale. */
  operatorChangesSince(
    draftId: number,
    afterRevision: number
  ): Promise<DraftChange[]>;
  /** Highest revision this store returned per draft; the host records them as seen when the turn ends. */
  readonly observedRevisions: ReadonlyMap<number, number>;
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
