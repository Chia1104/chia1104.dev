import type { ContentReadPort } from "@chia/agent-content/types";
import type { Locale } from "@chia/db/types";

import type {
  CommitDraftResult,
  DraftChange,
  DraftContentEdit,
  DraftEditResult,
  DraftWrite,
  FeedDraft,
  FeedDraftSummary,
  GitHubFile,
  GitHubRef,
  GitHubTree,
  MemoryDetail,
  MemorySearchInput,
  MemorySearchResult,
  MemorySummary,
  SavedMemory,
  SaveMemoryInput,
} from "./types.ts";

export type {
  CommitDraftResult,
  DraftChange,
  DraftFeedMeta,
  DraftTranslation,
  FeedDraft,
  FeedDraftSummary,
  GitHubEntryType,
  GitHubFile,
  GitHubRef,
  GitHubTree,
  GitHubTreeEntry,
  MemoryDetail,
  MemoryFreshness,
  MemoryHit,
  MemorySearchResult,
  MemoryKind,
  MemorySearchInput,
  MemoryStatus,
  MemorySummary,
  SavedMemory,
  SaveMemoryInput,
} from "./types.ts";

/**
 * The shared read port plus what only the writing agent may do: write the author's posts.
 * Carries no author id: the host builds this port for the configured author.
 */
export interface ContentPort extends ContentReadPort {
  /**
   * Writes the shared draft onto the feed, creating an unpublished one the first time, and
   * commits that content as a version of the draft under `message`. Applies exactly
   * `expectedHash`: a draft holding anything else is refused, never committed unseen.
   */
  applyDraft(input: {
    draftId: number;
    expectedHash: string;
    message: string;
  }): Promise<CommitDraftResult>;
  setPublished(input: {
    feedId: number;
    published: boolean;
  }): Promise<{ feedId: number; published: boolean }>;
}

/**
 * Read access to the repositories the operator listed in the kind config. The host enforces
 * that allowlist on every call and refuses anything else; the tools never see the token.
 * A ref resolved once in a turn stays pinned to that commit for the rest of it, so a tree
 * and the files read from it agree.
 */
export interface GitHubPort {
  resolveRef(
    input: { repo: string; ref?: string },
    signal?: AbortSignal
  ): Promise<GitHubRef>;
  /** One directory level, or the whole subtree with `recursive`. */
  listTree(
    input: { repo: string; ref?: string; path?: string; recursive?: boolean },
    signal?: AbortSignal
  ): Promise<GitHubTree>;
  /** Refuses directories, symlinks, submodules, binaries and blobs above the provider's inline limit. */
  readFile(
    input: { repo: string; ref?: string; path: string },
    signal?: AbortSignal
  ): Promise<GitHubFile>;
}

/**
 * The author's shared working drafts, addressed by id. Every write goes through the same
 * compare-and-set row the dashboard editor uses. An unknown or discarded id throws
 * {@link DraftNotFoundError}.
 */
export interface DraftStore {
  /** Drafts with unapplied work, newest first. Listing does not mark them as observed. */
  list(): Promise<FeedDraftSummary[]>;
  /** A feed's working draft, created from the feed when there is none; an empty draft for a new post without `feedId`. */
  open(input: { feedId?: number }): Promise<FeedDraft>;
  get(draftId: number): Promise<FeedDraft>;
  /**
   * Writes feed-level fields and per-locale fields together as one revision. `undefined`
   * leaves a field alone, `null` clears it. Each field is checked against what this store last
   * showed of it: one someone else changed since rejects the whole write instead of being
   * overwritten, while a change to any other field does not get in the way.
   */
  write(draftId: number, input: DraftWrite): Promise<FeedDraft>;
  /**
   * Exact-string replacements applied in order against the body as it is when the write
   * happens, so an operator save in between cannot be overwritten: every target still matches
   * once or the batch is refused.
   */
  editContent(
    draftId: number,
    locale: Locale,
    edits: readonly DraftContentEdit[]
  ): Promise<DraftEditResult>;
  /** Fields that differ from the draft as it was at `afterRevision`. */
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
  search(
    input: MemorySearchInput,
    signal?: AbortSignal
  ): Promise<MemorySearchResult>;
  get(id: number, signal?: AbortSignal): Promise<MemoryDetail | null>;
  listBySession(sessionId: string): Promise<MemorySummary[]>;
  listActiveLessons(limit: number): Promise<MemorySummary[]>;
}
