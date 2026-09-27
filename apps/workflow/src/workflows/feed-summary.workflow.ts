import "zod/compile";
import * as z from "zod";

import { ResourceType } from "@chia/services/rag/resource-types";
import { FeedChangeScope } from "@chia/workflow-control/contract";
import type { FeedSummaryOutput } from "@chia/workflow-control/contract";

import { summarizeFeedStep } from "../steps/feed-summary.step";
import { indexResource } from "../steps/resource-index.step";
import { scheduleFeedRevalidationStep } from "../steps/site-revalidation.step";

export const feedSummaryRequestSchema = z.object({
  feedID: z.number(),
});

/** A summary shows on its article only, never in a listing. */
const scheduleArticleRevalidation = async (slug: string) => {
  try {
    await scheduleFeedRevalidationStep(slug, FeedChangeScope.Article);
    return "ok";
  } catch (error) {
    return `failed: ${String(error)}`;
  }
};

/**
 * On the operator's request from the editor. Each translation with a body gets its summary
 * written, then is re-chunked: the chunk description reads it; www re-renders once any summary
 * landed. A run the editor can look up by id is why this is a workflow and not a request handler.
 */
export const feedSummaryWorkflow = async (
  request: z.input<typeof feedSummaryRequestSchema>
): Promise<FeedSummaryOutput> => {
  "use workflow";

  const { feedID } = feedSummaryRequestSchema.parse(request);

  const summarized = await summarizeFeedStep(feedID);
  if (!summarized) {
    return { success: false, error: "Feed not found" };
  }

  const translations = await Promise.all(
    summarized.translations.map(async (translation) => {
      if (translation.status !== "ok") {
        return { locale: translation.locale, status: translation.status };
      }
      try {
        await indexResource({
          sourceType: ResourceType.FeedTranslation,
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

  const site = summarized.translations.some(
    (translation) => translation.status === "ok"
  )
    ? await scheduleArticleRevalidation(summarized.slug)
    : "skipped";

  const success =
    !site.startsWith("failed") &&
    translations.every((translation) => translation.status === "ok");
  if (success) {
    console.log("Feed summary workflow finished", {
      feedID,
      translations,
      site,
    });
  } else {
    console.error("Feed summary workflow finished with failures", {
      feedID,
      translations,
      site,
    });
  }

  return { success, translations };
};
