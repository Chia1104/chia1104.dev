import { start } from "workflow/api";

import type { FeedHooks } from "@chia/api/orpc/utils";

import { feedIndexingWorkflow } from "../workflows/feed-indexing.workflow";
import { removeFeedFromSearchIndexWorkflow } from "../workflows/feed-removal.workflow";

/**
 * The feed hooks this process supplies: fire-and-forget indexing runs. Nobody waits on
 * the run — `feedIndexingWorkflow` logs its own failures — so the handle is dropped.
 */
export const feedHooks: FeedHooks = {
  async onFeedChanged(feedID) {
    await start(feedIndexingWorkflow, [{ feedID }]);
  },

  /**
   * Drops a feed's translations from the search index.
   *
   * A *hard* delete needs nothing here — `feed_search_document` and
   * `feed_embedding` both cascade from `feed_translation`. A *soft* delete is why
   * this exists: the rows survive, so without an explicit removal the post stays
   * searchable after being unpublished. Restoring re-emits `changed`, which
   * rebuilds them.
   */
  async onFeedRemoved(translationIDs) {
    if (translationIDs.length === 0) {
      return;
    }
    await start(removeFeedFromSearchIndexWorkflow, [
      { translationIDs: [...translationIDs] },
    ]);
  },
};
