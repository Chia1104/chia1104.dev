import { describe, expect, it } from "vitest";

import { replaceExact } from "../src/text";

describe("replaceExact", () => {
  const body = "## Title\n\nFirst paragraph.\n\nSecond paragraph.";

  it("replaces a unique match", () => {
    const result = replaceExact(body, "First paragraph.", "Rewritten.");
    expect(result).toMatchObject({ ok: true, replacements: 1 });
    expect(result.ok && result.content).toContain("Rewritten.");
  });

  it("refuses an ambiguous match rather than guessing", () => {
    const result = replaceExact("same line\nsame line", "same line", "changed");
    // The message must say how to proceed, since it is fed straight back to whoever typed it.
    expect(result).toMatchObject({
      ok: false,
      reason: "ambiguous",
      message: expect.stringMatching(/matches 2 places/),
    });
  });

  it("replaces every occurrence when asked", () => {
    expect(
      replaceExact("same line\nsame line", "same line", "changed", true)
    ).toEqual({ ok: true, content: "changed\nchanged", replacements: 2 });
  });

  it("reports a miss instead of silently doing nothing", () => {
    expect(replaceExact(body, "does not exist", "x")).toMatchObject({
      ok: false,
      reason: "not_found",
    });
  });

  it("rejects an empty target", () => {
    expect(replaceExact(body, "", "x")).toMatchObject({
      ok: false,
      reason: "empty_target",
    });
  });

  it("deletes when the replacement is empty", () => {
    expect(replaceExact(body, "\n\nSecond paragraph.", "")).toMatchObject({
      ok: true,
      content: "## Title\n\nFirst paragraph.",
    });
  });
});
