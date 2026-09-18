import { createGateway } from "@ai-sdk/gateway";
import { experimental_evaluate as evaluate } from "ai";

import { JEV_MODEL_ID } from "./provider.ts";
import type { RerankCandidate, RerankResult } from "./provider.ts";

/**
 * One call: a `choice` over the candidates and a `boolean` on whether any of
 * them answers the query, evaluated in parallel. Candidates go into the state
 * under short ids and the choice picks among those ids; a choice's
 * probabilities always sum to 1, so the boolean is what tells a genuine answer
 * from the closest irrelevant hit.
 */
export const rerankWithJev = async (
  query: string,
  candidates: RerankCandidate[],
  options: { apiKey: string; signal: AbortSignal }
): Promise<RerankResult> => {
  const entries = candidates.map((candidate, index) => ({
    id: `c${index + 1}`,
    key: candidate.key,
    title: candidate.title,
    // fresh literals: an interface has no index signature, so it is not a JSON object to the SDK
    matches: candidate.matches.map(({ headingPaths, snippet }) => ({
      headingPaths,
      snippet,
    })),
  }));

  const result = await evaluate({
    model: createGateway({ apiKey: options.apiKey }).evaluationModel(
      JEV_MODEL_ID
    ),
    abortSignal: options.signal,
    state: {
      query,
      candidates: entries.map(({ id, title, matches }) => ({
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
        criteria: Object.fromEntries(entries.map((entry) => [entry.id, null])),
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
    order: [...entries]
      .sort((a, b) => (probabilities[b.id] ?? 0) - (probabilities[a.id] ?? 0))
      .map((entry) => entry.key),
    answerable: answerable.probability,
  };
};
