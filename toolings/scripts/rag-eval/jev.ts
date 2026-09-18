import { createGateway } from "@ai-sdk/gateway";
import { experimental_evaluate as evaluate } from "ai";

import { toSearchMatches } from "@chia/services/rag/search.service";
import type { ResourceSearchHit } from "@chia/services/rag/search.service";

/** Vercel AI Gateway id, as `getAvailableModels()` lists it; the SDK's typed `jev-latest` is not served. */
const JEV_MODEL_ID = "typesafe-ai/jev";
/**
 * Hits handed to Jev per query. A choice accepts up to 255 options; the bound
 * is the 32k-token state, at roughly 500 tokens of excerpts per candidate.
 */
export const JEV_CANDIDATES = 20;
/** A call normally returns in about a second; one stalled for five minutes through the SDK's retries. */
const JEV_TIMEOUT_MS = 30_000;

export interface JevCandidate extends Pick<ResourceSearchHit, "chunks"> {
  /** slug or source URL: what the caller ranks by */
  key: string;
  title: string;
}

export interface JevRerank {
  /** candidate keys, best first */
  order: string[];
  /** P(true) that some candidate contains what the query asks for */
  answerable: number;
  inputTokens: number | undefined;
}

const gateway = (() => {
  let provider: ReturnType<typeof createGateway> | undefined;
  return () => {
    if (!provider) {
      const apiKey = process.env.AI_GATEWAY_API_KEY;
      if (!apiKey) {
        throw new Error(
          "mode hybrid+jev needs AI_GATEWAY_API_KEY in the environment (apps/service/.env has one)"
        );
      }
      provider = createGateway({ apiKey });
    }
    return provider;
  };
})();

/**
 * Reorders retrieval hits by Jev's probability that each one answers the query,
 * the way a reranker would sit between `searchResources` and an agent. The
 * excerpts are exactly what `search_memory` / `search_posts` show the agent, so
 * Jev sees no more than the agent would.
 */
export const rerankWithJev = async (
  query: string,
  candidates: JevCandidate[]
): Promise<JevRerank> => {
  const options = candidates.map((candidate, index) => ({
    id: `c${index + 1}`,
    key: candidate.key,
    title: candidate.title,
    // fresh literals: an interface has no index signature, so it is not a JSON object to the SDK
    matches: toSearchMatches(candidate.chunks).map(
      ({ headingPaths, snippet }) => ({ headingPaths, snippet })
    ),
  }));

  const result = await evaluate({
    model: gateway().evaluationModel(JEV_MODEL_ID),
    abortSignal: AbortSignal.timeout(JEV_TIMEOUT_MS),
    state: {
      query,
      candidates: options.map(({ id, title, matches }) => ({
        id,
        title,
        matches,
      })),
    },
    questions: {
      best: {
        type: "choice",
        instructions:
          "Which candidate contains the information the query asks for? Judge by what the excerpts state, not by shared vocabulary; the query may be in a different language from the candidates.",
        criteria: Object.fromEntries(
          options.map((option) => [option.id, null])
        ),
      },
      answerable: {
        type: "boolean",
        instructions:
          "Does at least one candidate contain the information the query asks for?",
      },
    },
  });

  const { best, answerable } = result.answers;
  const probabilities = best.probabilities ?? { [best.choice]: 1 };
  return {
    order: [...options]
      .sort((a, b) => (probabilities[b.id] ?? 0) - (probabilities[a.id] ?? 0))
      .map((option) => option.key),
    answerable: answerable.probability,
    inputTokens: result.usage.inputTokens,
  };
};
