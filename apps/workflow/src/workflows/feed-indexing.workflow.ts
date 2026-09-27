import "zod/compile";
import * as z from "zod";

import { ResourceType } from "@chia/services/rag/resource-types";
import { FeedChangeScope } from "@chia/workflow-control/contract";

import { estimateReadingTimeStep } from "../steps/estimate-reading-time.step";
import { loadFeedForIndexingStep } from "../steps/feed-indexing.step";
import { indexResource } from "../steps/resource-index.step";
import { scheduleFeedRevalidationStep } from "../steps/site-revalidation.step";

export const requestSchema = z.object({
  feedID: z.number(),
  /** Absent for a reindex that changed nothing www renders. */
  scope: z.enum(FeedChangeScope).optional(),
});

type Request = z.input<typeof requestSchema>;

export type BranchStatus = "ok" | `failed: ${string}`;

const settledStatus = (result: PromiseSettledResult<unknown>): BranchStatus =>
  result.status === "fulfilled" ? "ok" : `failed: ${String(result.reason)}`;

/**
 * After a feed changes. Per translation: reading time, plus chunk + vector indexing; then the
 * www pages `scope` names re-render, once the reading time they show is written.
 * Must also run on publish-state changes: visibility is mirrored onto the chunks for BM25.
 */
export const feedIndexingWorkflow = async (request: Request) => {
  "use workflow";

  const { feedID, scope } = requestSchema.parse(request);

  const feed = await loadFeedForIndexingStep(feedID);
  if (!feed) {
    return { success: false as const, error: "Feed not found" };
  }

  const translations = await Promise.all(
    feed.translations.map(async (translation) => {
      const resource = {
        sourceType: ResourceType.FeedTranslation,
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

  const [revalidation] = await Promise.allSettled(
    scope ? [scheduleFeedRevalidationStep(feed.slug, scope)] : []
  );
  const site = revalidation ? settledStatus(revalidation) : "skipped";

  // A branch that exhausted its retries leaves the translation unindexed until the next
  // feed change. `feedHooks.onFeedChanged` starts the run without inspecting the result,
  // so failures have to be logged.
  const failures = translations.filter(
    (translation) =>
      translation.readingTime !== "ok" || translation.index !== "ok"
  );
  const success = failures.length === 0 && !site.startsWith("failed");

  if (success) {
    console.log("Feed indexing workflow finished", { feedID, success });
  } else {
    console.error("Feed indexing workflow finished with failures", {
      feedID,
      failures,
      site,
    });
  }

  return { success, translations, site };
};
