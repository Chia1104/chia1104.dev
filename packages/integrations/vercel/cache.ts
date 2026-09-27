import { env } from "./env";

const INVALIDATE_TIMEOUT_MS = 10_000;

export class VercelApiError extends Error {
  constructor(
    readonly status: number,
    readonly operation: string
  ) {
    super(`Vercel ${operation} failed (HTTP ${status}).`);
    this.name = "VercelApiError";
  }
}

const { VERCEL_TOKEN, VERCEL_TEAM_ID, VERCEL_PROJECT_ID } = env;

/**
 * Marks production responses carrying any of `tags` stale; each re-renders in the background
 * on its next request. `null` where the project is not configured.
 */
export const invalidateCacheTags =
  VERCEL_TOKEN && VERCEL_TEAM_ID && VERCEL_PROJECT_ID
    ? async (tags: readonly string[]) => {
        const url = new URL(
          "https://api.vercel.com/v1/edge-cache/invalidate-by-tags"
        );
        url.searchParams.set("projectIdOrName", VERCEL_PROJECT_ID);
        url.searchParams.set("teamId", VERCEL_TEAM_ID);
        const response = await fetch(url, {
          method: "POST",
          headers: {
            authorization: `Bearer ${VERCEL_TOKEN}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ tags, target: "production" }),
          signal: AbortSignal.timeout(INVALIDATE_TIMEOUT_MS),
        });
        if (!response.ok) {
          throw new VercelApiError(response.status, "cache invalidation");
        }
      }
    : null;
