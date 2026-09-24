import "zod/compile";
import {
  buildFeedSummaryPrompt,
  normalizeFeedSummary,
} from "@chia/agent-host/feed-summary";
import { AGENT_TASK_IDS, resolveAgentTask } from "@chia/agent-host/tasks";
import { FEED_TASK_USAGE_KIND, recordAgentUsage } from "@chia/agent-host/usage";
import { connectDatabase, invalidateCache } from "@chia/db/client";
import {
  getFeedForIndexing,
  upsertFeedTranslation,
} from "@chia/db/repos/feeds";
import { feedTranslations } from "@chia/db/schema";
import type { Locale } from "@chia/db/types";
import { logger } from "@chia/observability/logger";
import { reportError } from "@chia/observability/report";

const SUMMARY_TIMEOUT_MS = 120_000;

export type FeedSummaryStatus = "ok" | "skipped: no body" | `failed: ${string}`;

export interface FeedSummaryTranslation {
  translationID: number;
  locale: Locale;
  status: FeedSummaryStatus;
}

/**
 * One model call per translation with a body, written straight to `feed_translation.summary`.
 * `null` when the feed is gone. A translation's failure is its status, not the step's: the
 * other language still lands. Runtime is imported at first use: this step is registered at
 * boot and the runtime carries the provider stack.
 */
export const summarizeFeedStep = async (
  feedID: number
): Promise<FeedSummaryTranslation[] | null> => {
  "use step";

  const db = await connectDatabase(undefined, { withCache: false });
  const feed = await getFeedForIndexing(db, { feedId: feedID });
  if (!feed) return null;

  const refs = feed.translations.map((translation) => ({
    translationID: translation.id,
    locale: translation.locale,
  }));

  const { completeText } = await import("@chia/agent-runtime/pi/complete");
  let task: Awaited<ReturnType<typeof resolveAgentTask>>;
  try {
    task = await resolveAgentTask(db, AGENT_TASK_IDS.feedSummary);
  } catch (error) {
    reportError(error, "Post summary task could not be resolved", { feedID });
    return refs.map((ref) => ({ ...ref, status: "failed: model unavailable" }));
  }

  const results = await Promise.all(
    feed.translations.map(
      async (translation, index): Promise<FeedSummaryTranslation> => {
        const ref = refs[index]!;
        const content = translation.content?.trim();
        if (!content) return { ...ref, status: "skipped: no body" };

        const reply = await completeText({
          models: task.models,
          model: task.model,
          // SAFETY: the definition carries a prompt, so `resolveAgentTask` always returns one.
          systemPrompt: task.systemPrompt!,
          text: buildFeedSummaryPrompt({
            locale: translation.locale,
            title: translation.title,
            content,
          }),
          ...task.params,
          signal: AbortSignal.timeout(SUMMARY_TIMEOUT_MS),
          // The house pays; the post's author is who it was for.
          onUsage: (usage) =>
            recordAgentUsage(db, {
              userId: feed.userId,
              kind: FEED_TASK_USAGE_KIND,
              source: "summary",
              credentialSource: "house",
              ...usage,
            }),
        });
        const summary = reply === null ? null : normalizeFeedSummary(reply);
        if (!summary) return { ...ref, status: "failed: no reply" };

        await upsertFeedTranslation(db, {
          feedId: feedID,
          locale: translation.locale,
          summary,
        });
        logger.info(
          { feedID, locale: translation.locale, chars: summary.length },
          "Post summary written"
        );
        return { ...ref, status: "ok" };
      }
    )
  );
  if (results.some((translation) => translation.status === "ok")) {
    await invalidateCache([feedTranslations]);
  }
  return results;
};

/** A retry would bill the model calls again; a failed language is re-run from the editor. */
summarizeFeedStep.maxRetries = 0;
