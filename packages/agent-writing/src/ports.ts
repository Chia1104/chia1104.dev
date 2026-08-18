import type { ContentReadPort, PostSnapshot } from "@chia/agent-content/types";
import type { Locale } from "@chia/db/types";

import type {
  CommitDraftInput,
  CommitDraftResult,
  DraftFeedMeta,
  DraftTranslation,
  FeedDraft,
  FetchedPage,
} from "./types.ts";

/**
 * Re-exported so consumers can import a port and every type in its signature from one place.
 */
export type {
  CommitDraftInput,
  CommitDraftResult,
  DraftFeedMeta,
  DraftTranslation,
  FeedDraft,
  FetchedPage,
} from "./types.ts";

/**
 * Ports this package needs from the host app.
 *
 * The split is deliberate: this package owns the writing agent's *domain* logic (tool contracts,
 * prompt assembly, draft semantics) and stays free of transport, auth and storage concerns.
 * `apps/service` implements these against the repo's existing repositories and feed services — see
 * `apps/service/src/services/agent-content.port.ts`.
 *
 * Shared Pi execution and workflow messaging live outside this package.
 */

// ============================================
// Content port
// ============================================

/**
 * The shared read port plus what only the writing agent may do: fetch outside pages and write
 * the author's posts.
 *
 * Carries no author id: the host builds this port *for* the configured author, so the tools have
 * nothing to restate. Authorization happened before the turn started.
 */
export interface ContentPort extends ContentReadPort {
  fetchPage(url: string): Promise<FetchedPage>;
  commitDraft(input: CommitDraftInput): Promise<CommitDraftResult>;
  setPublished(input: {
    feedId: number;
    published: boolean;
  }): Promise<{ feedId: number; published: boolean }>;
}

// ============================================
// Draft store
// ============================================

/**
 * Staging buffer for one writing session. Backed by `writing_agent_draft` +
 * `writing_agent_session.feedMeta`.
 */
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
