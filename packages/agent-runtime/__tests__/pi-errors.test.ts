import { fauxAssistantMessage } from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "vitest";

import { errorOfAssistantMessage, errorOfThrown } from "../src/pi/errors.ts";

const failed = (errorMessage: string) => {
  const message = fauxAssistantMessage("", { timestamp: 1 });
  message.stopReason = "error";
  message.errorMessage = errorMessage;
  return message;
};

describe("errorOfAssistantMessage", () => {
  it.each([
    ["401 Unauthorized: invalid x-api-key", "auth"],
    ["403 permission denied for this key", "auth"],
    ["429 insufficient_quota: You exceeded your current quota", "quota"],
    ["billing hard limit reached", "quota"],
    ["429 rate_limit_error: Too many requests", "rate_limited"],
    ["overloaded_error: Overloaded", "rate_limited"],
    ["prompt is too long: 250000 tokens > 200000 maximum", "context_overflow"],
    ["502 Bad Gateway", "provider"],
    ["fetch failed", "provider"],
  ] as const)("classifies %j as %s", (text, kind) => {
    expect(errorOfAssistantMessage(failed(text))).toEqual({
      kind,
      message: text,
    });
  });

  it("falls back to a generic message when the provider gave none", () => {
    const message = fauxAssistantMessage("", { timestamp: 1 });
    message.stopReason = "error";
    expect(errorOfAssistantMessage(message).kind).toBe("provider");
    expect(errorOfAssistantMessage(message).message).not.toBe("");
  });
});

describe("errorOfThrown", () => {
  it("treats anything thrown as internal", () => {
    expect(errorOfThrown(new Error("hook exploded"))).toEqual({
      kind: "internal",
      message: "hook exploded",
    });
    expect(errorOfThrown("plain")).toEqual({
      kind: "internal",
      message: "plain",
    });
  });
});
