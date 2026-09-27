import { FatalError } from "workflow";

import {
  VercelApiError,
  invalidateCacheTags,
} from "@chia/integrations/vercel/cache";
import { logger } from "@chia/observability/logger";
import { WwwCacheTag, wwwFeedCacheTag } from "@chia/utils/config";
import { FeedChangeScope } from "@chia/workflow-control/contract";

import { workflowControl } from "../services/workflow-control";

/** Joins or opens the window of each tag; see `siteRevalidationWorkflow`. */
const scheduleTags = async (tags: readonly string[]) => {
  await Promise.all(
    tags.map((tag) => workflowControl.startSiteRevalidation(tag))
  );
};

/**
 * www pages carry no revalidate timer, so every write that changes what the site renders ends
 * in one of these. Call it after the last write the pages read, or they re-render from the
 * old row.
 */
export const scheduleFeedRevalidationStep = async (
  slug: string,
  scope: FeedChangeScope
) => {
  "use step";

  await scheduleTags(
    scope === FeedChangeScope.Listing
      ? [wwwFeedCacheTag(slug), WwwCacheTag.Listings]
      : [wwwFeedCacheTag(slug)]
  );
};

/** A removal carries translation ids only, so it reaches every article instead of its own. */
export const scheduleRemovalRevalidationStep = async () => {
  "use step";

  await scheduleTags([WwwCacheTag.Listings, WwwCacheTag.Articles]);
};

/** The invalidation itself; only `siteRevalidationWorkflow` calls it, once per window. */
export const revalidateSiteStep = async (tag: string) => {
  "use step";

  if (!invalidateCacheTags) {
    logger.warn("Vercel project not configured; www keeps its cached pages");
    return;
  }
  try {
    await invalidateCacheTags([tag]);
  } catch (error) {
    // A rejected token or project does not fix itself on retry.
    if (
      error instanceof VercelApiError &&
      error.status >= 400 &&
      error.status < 500 &&
      error.status !== 408 &&
      error.status !== 429
    ) {
      throw new FatalError(error.message);
    }
    throw error;
  }
};
