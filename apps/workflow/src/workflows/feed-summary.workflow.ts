import "zod/compile";
import * as z from "zod";

import { FEED_TRANSLATION_SOURCE_TYPE } from "@chia/services/rag/resource-types";
import type { FeedSummaryOutput } from "@chia/workflow-control/contract";

import { summarizeFeedStep } from "../steps/feed-summary.step";
import { indexResource } from "../steps/resource-index.step";

export const feedSummaryRequestSchema = z.object({
  feedID: z.number(),
});

/**
 * On the operator's request from the editor. Each translation with a body gets its summary
 * written, then is re-chunked: the chunk description reads it. A run the editor can look up by
 * id is why this is a workflow and not a request handler.
 */
export const feedSummaryWorkflow = async (
  request: z.input<typeof feedSummaryRequestSchema>
): Promise<FeedSummaryOutput> => {
  "use workflow";

  const { feedID } = feedSummaryRequestSchema.parse(request);

  const summaries = await summarizeFeedStep(feedID);
  if (!summaries) {
    return { success: false, error: "Feed not found" };
  }

  const translations = await Promise.all(
    summaries.map(async (translation) => {
      if (translation.status !== "ok") {
        return { locale: translation.locale, status: translation.status };
      }
      try {
        await indexResource({
          sourceType: FEED_TRANSLATION_SOURCE_TYPE,
          sourceId: translation.translationID,
        });
        return { locale: translation.locale, status: "ok" };
      } catch (error) {
        return {
          locale: translation.locale,
          status: `failed: index: ${String(error)}`,
        };
      }
    })
  );

  const success = translations.every(
    (translation) => translation.status === "ok"
  );
  if (success) {
    console.log("Feed summary workflow finished", { feedID, translations });
  } else {
    console.error("Feed summary workflow finished with failures", {
      feedID,
      translations,
    });
  }

  return { success, translations };
};
