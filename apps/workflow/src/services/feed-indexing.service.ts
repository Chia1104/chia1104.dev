import type { FeedHooks } from "@chia/services/shared/context";

import { workflowControl } from "./workflow-control";

export const feedHooks: FeedHooks = {
  async onFeedChanged(feedID, scope) {
    await workflowControl.startFeedIndex(feedID, scope);
  },
  async onFeedRemoved(translationIDs) {
    if (translationIDs.length === 0) return;
    const { removeFeedFromSearchIndexWorkflow } =
      await import("../workflows/feed-removal.workflow");
    const { start } = await import("workflow/api");
    await start(removeFeedFromSearchIndexWorkflow, [
      { translationIDs: [...translationIDs] },
    ]);
  },
};
