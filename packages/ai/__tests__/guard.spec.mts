import type { TypeSafeClientConfig } from "@typesafe-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { checkDocumentWithJev, checkMessageWithJev } from "../src/guard/jev.ts";
import { resolveGuardProvider } from "../src/guard/provider.ts";

const options = { apiKey: "k", signal: AbortSignal.timeout(1_000) };

beforeEach(() => systemOne.mockReset());

describe("checkMessageWithJev", () => {
  it("asks both questions in one call and returns their probabilities", async () => {
    systemOne.mockResolvedValueOnce({
      answers: {
        injection: { type: "noul", noul: 0.91 },
        inappropriate: { type: "noul", noul: 0.04 },
      },
    });

    await expect(checkMessageWithJev("hi", options)).resolves.toEqual({
      injection: 0.91,
      inappropriate: 0.04,
    });
    expect(systemOne).toHaveBeenCalledTimes(1);
    expect(clientConfig).toHaveBeenCalledWith({ apiKey: "k" });
    const [request, requestOptions] = systemOne.mock.calls[0] ?? [];
    expect(request.state).toEqual({ message: "hi" });
    expect(Object.keys(request.questions)).toEqual([
      "injection",
      "inappropriate",
    ]);
    expect(request.model).toBe("jev-1.13.0");
    expect(requestOptions).toEqual({ signal: options.signal });
  });
});

describe("checkDocumentWithJev", () => {
  it("grades the whole text in one call", async () => {
    systemOne.mockResolvedValueOnce({
      answers: { injection: { type: "noul", noul: 0.88 } },
    });

    await expect(checkDocumentWithJev("page", options)).resolves.toEqual({
      injection: 0.88,
    });
    expect(systemOne.mock.calls[0]?.[0].state).toEqual({ text: "page" });
  });
});

describe("resolveGuardProvider", () => {
  it("is off unless GUARD_PROVIDER names a provider", () => {
    expect(resolveGuardProvider()).toBeNull();
  });
});
