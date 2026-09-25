import { describe, expect, it } from "vitest";

import { errorOfProviderMessage, errorOfThrown } from "../src/errors.ts";
import { AgentErrorKind } from "../src/types.ts";

describe("errorOfProviderMessage", () => {
  it.each([
    ["401 Unauthorized: invalid x-api-key", AgentErrorKind.Auth],
    ["403 permission denied for this key", AgentErrorKind.Auth],
    [
      "429 insufficient_quota: You exceeded your current quota",
      AgentErrorKind.Quota,
    ],
    ["billing hard limit reached", AgentErrorKind.Quota],
    ["429 rate_limit_error: Too many requests", AgentErrorKind.RateLimited],
    ["overloaded_error: Overloaded", AgentErrorKind.RateLimited],
    [
      "prompt is too long: 250000 tokens > 200000 maximum",
      AgentErrorKind.ContextOverflow,
    ],
    [
      "400 This model's maximum context length is 128000 tokens",
      AgentErrorKind.ContextOverflow,
    ],
    ["502 Bad Gateway", AgentErrorKind.Provider],
    ["fetch failed", AgentErrorKind.Provider],
  ] as const)("classifies %j as %s", (text, kind) => {
    expect(errorOfProviderMessage(text)).toEqual({ kind, message: text });
  });

  it("reads a context overflow as that, not as the 400 it arrives with", () => {
    expect(
      errorOfProviderMessage("400 invalid_request: input is too long").kind
    ).toBe(AgentErrorKind.ContextOverflow);
  });

  it("reads a failure with no text as the provider's", () => {
    expect(errorOfProviderMessage("")).toEqual({
      kind: AgentErrorKind.Provider,
      message: "",
    });
  });
});

describe("errorOfThrown", () => {
  it("treats anything thrown as internal", () => {
    expect(errorOfThrown(new Error("hook exploded"))).toEqual({
      kind: AgentErrorKind.Internal,
      message: "hook exploded",
    });
    expect(errorOfThrown("plain")).toEqual({
      kind: AgentErrorKind.Internal,
      message: "plain",
    });
  });
});
