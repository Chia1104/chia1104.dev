import type { TypeSafeClientConfig } from "@typesafe-ai/sdk";
import { describe, expect, it, vi } from "vitest";

const { systemOne, clientConfig } = vi.hoisted(() => ({
  systemOne: vi.fn(),
  clientConfig: vi.fn(),
}));
vi.mock("@typesafe-ai/sdk", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@typesafe-ai/sdk")>()),
  TypeSafeClient: class {
    systemOne = systemOne;
    constructor(config: TypeSafeClientConfig) {
      clientConfig(config);
    }
  },
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
    systemOne.mockResolvedValueOnce({
      answers: {
        best: {
          type: "choice",
          choice: "c2",
          confidence: 0.7,
          probabilities: { c1: 0.1, c2: 0.7, c3: 0.2 },
        },
        answerable: { type: "noul", noul: 0.93 },
      },
    });
    const signal = AbortSignal.timeout(1_000);

    const result = await rerankWithJev("q", candidates, {
      apiKey: "k",
      signal,
    });

    expect(result).toEqual({ order: ["b", "c", "a"], answerable: 0.93 });
    expect(clientConfig).toHaveBeenCalledWith({ apiKey: "k" });
    const [request, requestOptions] = systemOne.mock.calls[0] ?? [];
    // one option per candidate, and the excerpts travel in the state under the same ids
    expect(request.questions.best).toMatchObject({
      type: "choice",
      criteria: { c1: null, c2: null, c3: null },
    });
    expect(request.questions.answerable.type).toBe("noul");
    expect(
      request.state.candidates.map((entry: { id: string }) => entry.id)
    ).toEqual(["c1", "c2", "c3"]);
    expect(request.state.candidates[1]).toEqual({
      id: "c2",
      title: "B",
      matches: [{ headingPaths: ["B > 1"], snippet: "beta" }],
    });
    expect(request.model).toBe("jev-1.13.0");
    expect(requestOptions).toEqual({ signal });
  });
});

describe("resolveRerankProvider", () => {
  it("is off unless RERANK_PROVIDER names a provider", () => {
    expect(resolveRerankProvider()).toBeNull();
  });
});
