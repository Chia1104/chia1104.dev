import { beforeEach, describe, expect, it, vi } from "vitest";

const evaluate = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({ experimental_evaluate: evaluate }));
vi.mock("@ai-sdk/gateway", () => ({
  createGateway: () => ({ evaluationModel: (id: string) => ({ id }) }),
}));

import { checkDocumentWithJev, checkMessageWithJev } from "../src/guard/jev.ts";
import { resolveGuardProvider } from "../src/guard/provider.ts";

const options = { apiKey: "k", signal: AbortSignal.timeout(1_000) };

beforeEach(() => evaluate.mockReset());

describe("checkMessageWithJev", () => {
  it("asks both questions in one call and returns their probabilities", async () => {
    evaluate.mockResolvedValueOnce({
      answers: {
        injection: { type: "boolean", probability: 0.91 },
        inappropriate: { type: "boolean", probability: 0.04 },
      },
    });

    await expect(checkMessageWithJev("hi", options)).resolves.toEqual({
      injection: 0.91,
      inappropriate: 0.04,
    });
    expect(evaluate).toHaveBeenCalledTimes(1);
    const call = evaluate.mock.calls[0]?.[0];
    expect(call.state).toEqual({ message: "hi" });
    expect(call.model).toEqual({ id: "typesafe-ai/jev" });
  });
});

describe("checkDocumentWithJev", () => {
  it("grades the whole text in one call", async () => {
    evaluate.mockResolvedValueOnce({
      answers: { injection: { type: "boolean", probability: 0.88 } },
    });

    await expect(checkDocumentWithJev("page", options)).resolves.toEqual({
      injection: 0.88,
    });
    expect(evaluate.mock.calls[0]?.[0].state).toEqual({ text: "page" });
  });
});

describe("resolveGuardProvider", () => {
  it("is off unless GUARD_PROVIDER names a provider", () => {
    expect(resolveGuardProvider()).toBeNull();
  });
});
