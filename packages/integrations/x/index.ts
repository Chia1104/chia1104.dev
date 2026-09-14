import { fetchTweet } from "react-tweet/api";
import type { Tweet } from "react-tweet/api";

export type TweetResult =
  | { status: "found"; tweet: Tweet }
  | { status: "unavailable"; reason: "not-found" | "private" };

/** The syndication endpoint is unofficial and occasionally hangs; a render must not wait on it. */
const FETCH_TIMEOUT_MS = 8000;

/**
 * Reads one post through X's syndication API. A missing or private post is a result, not an
 * error; transport and upstream failures throw.
 */
export const getTweet = async (
  id: string,
  signal?: AbortSignal
): Promise<TweetResult> => {
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const { data, tombstone } = await fetchTweet(id, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });

  if (data) return { status: "found", tweet: data };
  return {
    status: "unavailable",
    reason: tombstone ? "private" : "not-found",
  };
};
