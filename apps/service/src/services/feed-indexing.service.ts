import { start } from "workflow/api";

import { feedIndexingWorkflow } from "../workflows/feed-indexing.workflow";
import { removeFeedFromSearchIndexWorkflow } from "../workflows/feed-removal.workflow";

export async function syncFeedSearchIndex(feedID: number) {
  return await start(feedIndexingWorkflow, [{ feedID }]);
}

/**
 * Drops a feed's translations from the search index.
 *
 * A *hard* delete needs nothing here — `feed_search_document` and
 * `feed_embedding` both cascade from `feed_translation`. A *soft* delete is why
 * this exists: the rows survive, so without an explicit removal the post stays
 * searchable after being unpublished. Restoring re-emits `changed`, which
 * rebuilds them.
 */
export async function removeFeedFromSearchIndex(
  translationIDs: readonly number[]
) {
  if (translationIDs.length === 0) {
    return;
  }

  await start(removeFeedFromSearchIndexWorkflow, [
    { translationIDs: [...translationIDs] },
  ]);
}
