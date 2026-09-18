import { env, RerankProviderId } from "../env.ts";

/** Vercel AI Gateway id, as `getAvailableModels()` lists it; the SDK's typed `jev-latest` is not served. */
export const JEV_MODEL_ID = "typesafe-ai/jev";

/**
 * Below this `answerable` the corpus probably does not cover the query. Measured on
 * the production corpus: queries with no answer score 0.03–0.07, answerable ones
 * 0.35–0.98.
 */
export const RERANK_ANSWERABLE_FLOOR = 0.3;

/** One retrieval hit as a reranker sees it: the excerpts the agent is shown, no more. */
export interface RerankCandidate {
  /** unique within one call; the order comes back in these */
  key: string;
  title: string;
  matches: { headingPaths: string[]; snippet: string }[];
}

export interface RerankResult {
  /** candidate keys, best first */
  order: string[];
  /** P(true) that some candidate contains what the query asks for */
  answerable: number;
}

/**
 * The seam for a model that reorders retrieval hits and says whether any of
 * them answers the query. Off by default, unlike embeddings: every call is a
 * vendor round trip on an agent's search.
 */
export interface RerankProvider {
  readonly id: string;
  rerank(
    query: string,
    candidates: RerankCandidate[],
    options: { signal: AbortSignal }
  ): Promise<RerankResult>;
}

/**
 * `./jev.ts` is imported inside `rerank`, not at module scope: resolving the
 * provider is on the path of every search, but the gateway SDK is only needed
 * once a call is made.
 */
export const jevRerankProvider = (): RerankProvider => ({
  id: JEV_MODEL_ID,
  rerank: async (query, candidates, options) => {
    if (!env.RERANK_API_KEY) {
      throw new Error(
        "RERANK_API_KEY is not set; the Jev rerank provider needs it."
      );
    }
    return await (
      await import("./jev.ts")
    ).rerankWithJev(query, candidates, {
      apiKey: env.RERANK_API_KEY,
      signal: options.signal,
    });
  },
});

/** Null when reranking is off, so a caller skips the wider candidate fetch as well as the call. */
export const resolveRerankProvider = (): RerankProvider | null =>
  env.RERANK_PROVIDER === RerankProviderId.Jev ? jevRerankProvider() : null;
