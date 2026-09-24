import { fauxAssistantMessage } from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "vitest";

import { errorOfAssistantMessage, errorOfThrown } from "../src/pi/errors.ts";
import { AgentErrorKind } from "../src/types.ts";

const failed = (errorMessage: string) => {
  const message = fauxAssistantMessage("", { timestamp: 1 });
  message.stopReason = "error";
  message.errorMessage = errorMessage;
  return message;
};

describe("errorOfAssistantMessage", () => {
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
    ["502 Bad Gateway", AgentErrorKind.Provider],
    ["fetch failed", AgentErrorKind.Provider],
  ] as const)("classifies %j as %s", (text, kind) => {
    expect(errorOfAssistantMessage(failed(text))).toEqual({
      kind,
      message: text,
    });
  });

  it("falls back to a generic message when the provider gave none", () => {
    const message = fauxAssistantMessage("", { timestamp: 1 });
    message.stopReason = "error";
    expect(errorOfAssistantMessage(message).kind).toBe(AgentErrorKind.Provider);
    expect(errorOfAssistantMessage(message).message).not.toBe("");
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
