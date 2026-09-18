import { describe, expect, it, vi } from "vitest";

const evaluate = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({ experimental_evaluate: evaluate }));
vi.mock("@ai-sdk/gateway", () => ({
  createGateway: () => ({ evaluationModel: (id: string) => ({ id }) }),
}));

import { rerankWithJev } from "../src/rerank/jev.ts";
import { resolveRerankProvider } from "../src/rerank/provider.ts";

const candidates = [
  { key: "a", title: "A", matches: [{ headingPaths: [], snippet: "alpha" }] },
  {
    key: "b",
    title: "B",
    matches: [{ headingPaths: ["B > 1"], snippet: "beta" }],
  },
  { key: "c", title: "C", matches: [{ headingPaths: [], snippet: "gamma" }] },
];

describe("rerankWithJev", () => {
  it("orders candidates by choice probability and reports answerability", async () => {
    evaluate.mockResolvedValueOnce({
      answers: {
        best: {
          type: "choice",
          choice: "c2",
          probabilities: { c1: 0.1, c2: 0.7, c3: 0.2 },
        },
        answerable: { type: "boolean", probability: 0.93 },
      },
    });

    const result = await rerankWithJev("q", candidates, {
      apiKey: "k",
      signal: AbortSignal.timeout(1_000),
    });

    expect(result).toEqual({ order: ["b", "c", "a"], answerable: 0.93 });
    const call = evaluate.mock.calls[0]?.[0];
    // one option per candidate, and the excerpts travel in the state under the same ids
    expect(Object.keys(call.questions.best.criteria)).toEqual([
      "c1",
      "c2",
      "c3",
    ]);
    expect(
      call.state.candidates.map((entry: { id: string }) => entry.id)
    ).toEqual(["c1", "c2", "c3"]);
    expect(call.state.candidates[1]).toEqual({
      id: "c2",
      title: "B",
      matches: [{ headingPaths: ["B > 1"], snippet: "beta" }],
    });
    expect(call.model).toEqual({ id: "typesafe-ai/jev" });
  });

  it("falls back to the chosen option when no distribution comes back", async () => {
    evaluate.mockResolvedValueOnce({
      answers: {
        best: { type: "choice", choice: "c3" },
        answerable: { type: "boolean", probability: 0.5 },
      },
    });

    const result = await rerankWithJev("q", candidates, {
      apiKey: "k",
      signal: AbortSignal.timeout(1_000),
    });

    expect(result.order[0]).toBe("c");
  });
});

describe("resolveRerankProvider", () => {
  it("is off unless RERANK_PROVIDER names a provider", () => {
    expect(resolveRerankProvider()).toBeNull();
  });
});
