import { describe, expect, it } from "vitest";

import { asError, isAbortError, messageOf } from "../src/error-helper";

describe("messageOf", () => {
  it("reads an Error's message", () => {
    expect(messageOf(new Error("boom"))).toBe("boom");
  });

  it("renders anything else as text unless a fallback is given", () => {
    expect(messageOf(42)).toBe("42");
    expect(messageOf({ code: 1 }, "Something went wrong.")).toBe(
      "Something went wrong."
    );
  });
});

describe("asError", () => {
  it("returns an Error unchanged", () => {
    const error = new Error("boom");
    expect(asError(error)).toBe(error);
  });

  it("wraps anything else and keeps it as the cause", () => {
    const thrown = { code: "E1" };
    const error = asError(thrown);
    expect(error.message).toBe("[object Object]");
    expect(error.cause).toBe(thrown);
  });
});

describe("isAbortError", () => {
  it("recognises an abort by name only", () => {
    expect(isAbortError(new DOMException("stopped", "AbortError"))).toBe(true);
    expect(isAbortError(new Error("AbortError"))).toBe(false);
    expect(isAbortError("AbortError")).toBe(false);
  });
});
