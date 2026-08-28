import type { FeedHooks } from "@chia/api/orpc/utils";

import { workflowControl } from "./workflow-control";

export const feedHooks: FeedHooks = {
  async onFeedChanged(feedID) {
    await workflowControl.startFeedIndex(feedID);
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
