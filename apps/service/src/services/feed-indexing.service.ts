import { start } from "workflow/api";

import { deleteFeedFromAlgoliaWorkflow } from "../workflows/algolia-search.workflow";
import { feedIndexingWorkflow } from "../workflows/feed-indexing.workflow";

export async function syncFeedSearchIndex(feedID: number) {
  return await start(feedIndexingWorkflow, [{ feedID }]);
}

export async function removeFeedFromSearchIndex(
  translationIDs: readonly number[]
) {
  if (translationIDs.length === 0) {
    return;
  }

  await start(deleteFeedFromAlgoliaWorkflow, [
    {
      objectIDs: [...translationIDs],
    },
  ]);
}
