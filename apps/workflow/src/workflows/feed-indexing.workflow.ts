import "zod/compile";
import * as z from "zod";

import { FEED_TRANSLATION_SOURCE_TYPE } from "@chia/api/resources/registry";

import { estimateReadingTimeStep } from "../steps/estimate-reading-time.step";
import { loadFeedForIndexingStep } from "../steps/feed-indexing.step";
import { indexResource } from "../steps/resource-index.step";

export const requestSchema = z.object({
  feedID: z.number(),
});

type Request = z.input<typeof requestSchema>;

export type BranchStatus = "ok" | `failed: ${string}`;

const settledStatus = (result: PromiseSettledResult<unknown>): BranchStatus =>
  result.status === "fulfilled" ? "ok" : `failed: ${String(result.reason)}`;

/**
 * Entry point after a feed changes.
 *
 * Runs per translation: reading time, plus chunk + vector indexing through the
 * resource pipeline. Must also run on publish-state changes — visibility is
 * mirrored onto the chunks so BM25 can filter on it.
 */
export const feedIndexingWorkflow = async (request: Request) => {
  "use workflow";

  const { feedID } = requestSchema.parse(request);

  const feed = await loadFeedForIndexingStep(feedID);
  if (!feed) {
    return { success: false as const, error: "Feed not found" };
  }

  const translations = await Promise.all(
    feed.translations.map(async (translation) => {
      const resource = {
        sourceType: FEED_TRANSLATION_SOURCE_TYPE,
        sourceId: translation.translationID,
      };

      const [readingTime, index] = await Promise.allSettled([
        estimateReadingTimeStep(
          feedID,
          translation.locale,
          translation.content ?? translation.description ?? ""
        ),
        indexResource(resource),
      ]);

      return {
        locale: translation.locale,
        readingTime: settledStatus(readingTime),
        index: settledStatus(index),
      };
    })
  );

  // a branch that exhausted its retries leaves the translation unindexed until
  // the next feed change, so it has to be loud rather than a `success: false`
  // nobody reads — `feedHooks.onFeedChanged` starts the run without
  // inspecting the result
  const failures = translations.filter(
    (translation) =>
      translation.readingTime !== "ok" || translation.index !== "ok"
  );

  if (failures.length > 0) {
    console.error("Feed indexing workflow finished with failures", {
      feedID,
      failures,
    });
  } else {
    console.log("Feed indexing workflow finished", { feedID, success: true });
  }

  return { success: failures.length === 0, translations };
};
