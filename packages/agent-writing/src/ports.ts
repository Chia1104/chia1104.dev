import type { Locale } from "@chia/db/types";

import type {
  CommitDraftInput,
  CommitDraftResult,
  DraftFeedMeta,
  DraftTranslation,
  FeedDraft,
  FetchedPage,
  PostListItem,
  PostSearchHit,
  PostSnapshot,
  TagItem,
} from "./types.ts";

/**
 * Re-exported so an adapter can import a port and every type in its signature from one place.
 */
export type {
  CommitDraftInput,
  CommitDraftResult,
  DraftFeedMeta,
  DraftTranslation,
  FeedDraft,
  FetchedPage,
  PostFeedType,
  PostListItem,
  PostSearchHit,
  PostSnapshot,
  TagItem,
} from "./types.ts";

/**
 * Ports this package needs from the host app.
 *
 * The split is deliberate: this package owns the writing agent's *domain* logic (tool contracts,
 * prompt assembly, draft semantics) and stays free of transport, auth and Algolia/S3 concerns.
 * `apps/service` implements these against the repo's existing repositories and feed services — see
 * `apps/service/src/services/agent-content.port.ts`.
 *
 * Transport-agnostic ports that every agent kind needs (the steering queue) live in
 * `@chia/agent-core/ports`.
 */

// ============================================
// Content port
// ============================================

export interface SearchPostsInput {
  keyword: string;
  locale?: Locale;
  /** `algolia` for keyword search, an embedding model id for semantic search. */
  mode: "algolia" | "semantic";
  limit: number;
}

export interface ListPostsInput {
  adminId: string;
  limit: number;
  /** Omit for both. */
  published?: boolean;
}

export interface GetPostInput {
  slug?: string;
  feedId?: number;
  locale?: Locale;
}

/**
 * Read/write access to the published content domain.
 *
 * Every method is scoped by the caller to the configured admin — this port does no
 * authorization of its own, the oRPC `adminGuard` already ran.
 */
export interface ContentPort {
  searchPosts(input: SearchPostsInput): Promise<PostSearchHit[]>;
  getPost(input: GetPostInput): Promise<PostSnapshot | null>;
  listPosts(input: ListPostsInput): Promise<PostListItem[]>;
  listTags(): Promise<TagItem[]>;
  fetchPage(url: string): Promise<FetchedPage>;
  commitDraft(input: CommitDraftInput): Promise<CommitDraftResult>;
  setPublished(input: {
    adminId: string;
    feedId: number;
    published: boolean;
  }): Promise<{ feedId: number; published: boolean }>;
}

// ============================================
// Draft store
// ============================================

/** Staging buffer for one agent session. Backed by `agent_draft` + `agent_session.feedMeta`. */
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
