import type { FeedHooks } from "@chia/api/orpc/utils";

import { workflowControl } from "../repos/workflow-control.repo";

/** Fire-and-forget indexing; the workflow logs its own failures so the handle is dropped. */
export const feedHooks: FeedHooks = {
  async onFeedChanged(feedID) {
    await workflowControl.startFeedIndex(feedID);
  },

  /**
   * Soft delete only: hard deletes cascade, but unpublished rows would stay searchable.
   * Restoring re-emits `changed`.
   */
  async onFeedRemoved(translationIDs) {
    if (translationIDs.length === 0) {
      return;
    }
    await workflowControl.startFeedRemoval([...translationIDs]);
  },
};
