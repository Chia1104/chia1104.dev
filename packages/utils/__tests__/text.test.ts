import { describe, expect, it } from "vitest";

import {
  applyEdits,
  excerptAround,
  lineAt,
  numberLines,
  replaceExact,
} from "../src/text";

describe("replaceExact", () => {
  const body = "## Title\n\nFirst paragraph.\n\nSecond paragraph.";

  it("replaces a unique match and reports where it starts", () => {
    expect(replaceExact(body, "First paragraph.", "Rewritten.")).toEqual({
      ok: true,
      content: "## Title\n\nRewritten.\n\nSecond paragraph.",
      replacements: 1,
      offsets: [10],
    });
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

  it("replaces every occurrence when asked, with an offset per replacement", () => {
    expect(
      replaceExact("same line\nsame line", "same line", "changed", true)
    ).toEqual({
      ok: true,
      content: "changed\nchanged",
      replacements: 2,
      offsets: [0, 8],
    });
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

  it("inserts dollar sequences verbatim instead of expanding them as replacement patterns", () => {
    expect(
      replaceExact("Cost is $O(n)$ per call.", "$O(n)$", "$$O(n \\log n)$$")
    ).toMatchObject({
      ok: true,
      content: "Cost is $$O(n \\log n)$$ per call.",
    });
    expect(replaceExact("a b", "b", "$&$'$`")).toMatchObject({
      ok: true,
      content: "a $&$'$`",
    });
  });

  it("deletes when the replacement is empty", () => {
    expect(replaceExact(body, "\n\nSecond paragraph.", "")).toMatchObject({
      ok: true,
      content: "## Title\n\nFirst paragraph.",
    });
  });
});

describe("numberLines", () => {
  it("right-aligns numbers so the body stays readable past line 9", () => {
    const lines = numberLines(
      Array.from({ length: 10 }, (_, index) => `line ${index + 1}`).join("\n")
    ).split("\n");
    expect(lines[0]).toBe(" 1\tline 1");
    expect(lines[9]).toBe("10\tline 10");
  });

  it("starts from the given line", () => {
    expect(numberLines("a\nb", 41)).toBe("41\ta\n42\tb");
  });
});

describe("excerptAround", () => {
  const body = ["l1", "l2", "l3", "l4", "l5", "l6"].join("\n");

  it("finds the line of an offset and clamps the window to the text", () => {
    expect(lineAt(body, 0)).toBe(1);
    expect(lineAt(body, body.indexOf("l4"))).toBe(4);
    expect(excerptAround(body, body.indexOf("l5"), 2)).toEqual({
      line: 5,
      text: "3\tl3\n4\tl4\n5\tl5\n6\tl6",
    });
    expect(excerptAround(body, 0, 1)).toEqual({
      line: 1,
      text: "1\tl1\n2\tl2",
    });
  });
});

describe("applyEdits", () => {
  it("applies in order and keeps every offset relative to the final content", () => {
    const body = "alpha\nbeta\ngamma";
    const result = applyEdits(body, [
      { oldString: "gamma", newString: "GAMMA!" },
      { oldString: "alpha", newString: "a" },
    ]);
    expect(result).toEqual({
      ok: true,
      content: "a\nbeta\nGAMMA!",
      edits: [
        { replacements: 1, offsets: [7] },
        { replacements: 1, offsets: [0] },
      ],
    });
  });

  it("refuses the batch at the first edit that does not match once", () => {
    expect(
      applyEdits("x y", [
        { oldString: "x", newString: "1" },
        { oldString: "nope", newString: "2" },
      ])
    ).toMatchObject({ ok: false, index: 1, reason: "not_found" });
  });
});
