import { X_CH_INTERNAL_TOKEN } from "@chia/utils/gateway";

import { env } from "../env";

/**
 * HTTP client for the standalone workflow service's internal trigger routes.
 * Deliberately no in-process fallback: `start()` requires the compile-time
 * workflow references produced by the workflow/nitro transform, which only
 * apps/workflow has. When INTERNAL_WORKFLOW_SERVICE_ENDPOINT is not
 * configured, background indexing is skipped with a warning — run `dev:micro`
 * locally to have the workflow service available.
 */
const triggerWorkflow = async (path: string, body: unknown) => {
  if (!env.INTERNAL_WORKFLOW_SERVICE_ENDPOINT) {
    console.warn(
      `INTERNAL_WORKFLOW_SERVICE_ENDPOINT is not set, skipping workflow trigger ${path}`
    );
    return null;
  }

  const origin = env.INTERNAL_WORKFLOW_SERVICE_ENDPOINT.replace(/\/$/, "");
  const headers = new Headers({ "content-type": "application/json" });
  if (env.INTERNAL_WORKFLOW_SERVICE_TOKEN) {
    headers.set(X_CH_INTERNAL_TOKEN, env.INTERNAL_WORKFLOW_SERVICE_TOKEN);
  }

  const response = await fetch(`${origin}/workflow/internal/workflows${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `workflow trigger ${path} failed: ${response.status} ${await response
        .text()
        .catch(() => "")}`
    );
  }

  return (await response.json()) as { runId: string | null };
};

export async function syncFeedSearchIndex(feedID: number) {
  return await triggerWorkflow("/feed-indexing", { feedID });
}

export async function removeFeedFromSearchIndex(
  translationIDs: readonly number[]
) {
  if (translationIDs.length === 0) {
    return;
  }

  return await triggerWorkflow("/algolia-delete", {
    objectIDs: [...translationIDs],
  });
}
