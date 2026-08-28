import type { FeedHooks } from "@chia/api/orpc/utils";

import { workflowControl } from "./workflow-control";

/**
 * The feed hooks this process supplies: fire-and-forget indexing runs. Nobody waits on
 * the run — `feedIndexingWorkflow` logs its own failures — so the handle is dropped.
 */
export const feedHooks: FeedHooks = {
  async onFeedChanged(feedID) {
    await workflowControl.startFeedIndex(feedID);
  },

  /**
   * Drops a feed's translations from the search index.
   *
   * A *hard* delete needs nothing here — `resource_chunk` cascades from
   * `feed_translation` and `resource_embedding` from the chunk. A *soft* delete
   * is why this exists: the rows survive, so without an explicit removal the
   * post stays searchable after being unpublished. Restoring re-emits
   * `changed`, which rebuilds them.
   */
  async onFeedRemoved(translationIDs) {
    if (translationIDs.length === 0) {
      return;
    }
    await workflowControl.startFeedRemoval([...translationIDs]);
  },
};
