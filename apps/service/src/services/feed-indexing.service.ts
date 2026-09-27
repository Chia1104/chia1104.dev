import type { FeedHooks } from "@chia/services/shared/context";

import { workflowControl } from "../repos/workflow-control.repo";

/** Fire-and-forget indexing; the workflow logs its own failures so the handle is dropped. */
export const feedHooks: FeedHooks = {
  async onFeedChanged(feedID, scope) {
    await workflowControl.startFeedIndex(feedID, scope);
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
