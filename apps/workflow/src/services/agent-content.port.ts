import type { ContentPort } from "@chia/agent-writing/ports";
import { createContentReadPort } from "@chia/api/agents/content-read.port";
import { applyFeedDraftService } from "@chia/api/feeds/draft";
import { updateFeedService } from "@chia/api/feeds/write";
import type { DB } from "@chia/db/client";

import { feedHooks } from "./feed-indexing.service";

/**
 * Author-visibility reads plus the writing agent's two feed writes, through the same services
 * the dashboard uses. Indexing is passed in: a workflow step has no request context. `adminId`
 * is the configured author, never tool input.
 */

export interface CreateContentPortOptions {
  db: DB;
  /** Configured author; the writing kind admits no one else. */
  adminId: string;
  /** After a successful `applyDraft`. The turn reads it once the turn has ended. */
  onCommitted?: () => void;
}

export const createAgentContentPort = (
  options: CreateContentPortOptions
): ContentPort => {
  const { db, adminId, onCommitted } = options;

  const read = createContentReadPort({
    db,
    authorId: adminId,
    visibility: "author",
  });

  return {
    ...read,

    async applyDraft(input) {
      const result = await applyFeedDraftService(
        db,
        { draftId: input.draftId, adminId },
        feedHooks
      );
      onCommitted?.();
      return result;
    },

    async setPublished(input) {
      const updated = await updateFeedService(
        db,
        { feedId: input.feedId, published: input.published },
        feedHooks
      );
      return { feedId: updated.id, published: updated.published };
    },
  };
};
