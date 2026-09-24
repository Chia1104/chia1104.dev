import { describe, expect, it } from "vitest";

import {
  ExactReplaceFailure,
  MatchMode,
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
      matches: [{ start: 10, end: 26 }],
      match: MatchMode.Exact,
    });
  });

  it("falls back to ignoring trailing whitespace, then indentation, keeping the first line's indent", () => {
    const indented = "- item\n  continued  \n  last";
    expect(replaceExact(indented, "continued\nlast", "one\ntwo")).toMatchObject(
      {
        ok: true,
        content: "- item\n  one\ntwo",
        match: MatchMode.Whitespace,
        matches: [{ start: 9, end: 27 }],
      }
    );
    expect(replaceExact("a  \nb", "a\nb", "c")).toMatchObject({
      ok: true,
      content: "c",
      match: MatchMode.TrailingWhitespace,
    });
  });

  it("reads typographic quotes and dashes as their ASCII forms, but never word content", () => {
    const curly = "She said \u201Chello\u201D \u2014 twice.";
    expect(
      replaceExact(curly, 'She said "hello" - twice.', "Rewritten.")
    ).toMatchObject({
      ok: true,
      content: "Rewritten.",
      match: MatchMode.Punctuation,
    });
    expect(replaceExact(curly, 'She said "hi" - twice.', "x")).toMatchObject({
      ok: false,
      reason: ExactReplaceFailure.NotFound,
    });
  });

  it("never lets whitespace dropped from the target's edges match inside a word", () => {
    expect(replaceExact("foobar", " foo ", "X")).toMatchObject({
      ok: false,
      reason: ExactReplaceFailure.NotFound,
    });
    expect(replaceExact("foobar", "foo ", "X")).toMatchObject({
      ok: false,
      reason: ExactReplaceFailure.NotFound,
    });
    expect(replaceExact("使用foo工具", " foo ", "X")).toMatchObject({
      ok: false,
      reason: ExactReplaceFailure.NotFound,
    });
    expect(replaceExact("**foo** bar", " foo ", "X")).toMatchObject({
      ok: true,
      content: "**X** bar",
      match: MatchMode.Whitespace,
    });
  });

  it("prefers the exact match and counts every relaxed match for ambiguity", () => {
    expect(replaceExact("x \nx\nx  ", "x", "y", true)).toMatchObject({
      ok: true,
      content: "y \ny\ny  ",
      match: MatchMode.Exact,
    });
    expect(replaceExact("foo \nfoo \n", "foo\n", "bar\n")).toMatchObject({
      ok: false,
      reason: ExactReplaceFailure.Ambiguous,
    });
  });

  it("refuses an ambiguous match rather than guessing", () => {
    const result = replaceExact("same line\nsame line", "same line", "changed");
    // The message must say how to proceed, since it is fed straight back to whoever typed it.
    expect(result).toMatchObject({
      ok: false,
      reason: ExactReplaceFailure.Ambiguous,
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
      matches: [
        { start: 0, end: 9 },
        { start: 10, end: 19 },
      ],
      match: MatchMode.Exact,
    });
  });

  it("reports a miss instead of silently doing nothing", () => {
    expect(replaceExact(body, "does not exist", "x")).toMatchObject({
      ok: false,
      reason: ExactReplaceFailure.NotFound,
    });
  });

  it("rejects an empty target", () => {
    expect(replaceExact(body, "", "x")).toMatchObject({
      ok: false,
      reason: ExactReplaceFailure.EmptyTarget,
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
        { replacements: 1, offsets: [7], match: MatchMode.Exact },
        { replacements: 1, offsets: [0], match: MatchMode.Exact },
      ],
    });
  });

  it("shifts earlier offsets by what a relaxed match actually removed", () => {
    const result = applyEdits("first   \nsecond", [
      { oldString: "second", newString: "2nd" },
      { oldString: "first\n", newString: "1\n" },
    ]);
    expect(result).toEqual({
      ok: true,
      content: "1\n2nd",
      edits: [
        { replacements: 1, offsets: [2], match: MatchMode.Exact },
        { replacements: 1, offsets: [0], match: MatchMode.TrailingWhitespace },
      ],
    });
  });

  it("moves an earlier offset a later edit swallowed to that replacement's start", () => {
    expect(
      applyEdits("abc", [
        { oldString: "b", newString: "X" },
        { oldString: "aXc", newString: "q" },
      ])
    ).toEqual({
      ok: true,
      content: "q",
      edits: [
        { replacements: 1, offsets: [0], match: MatchMode.Exact },
        { replacements: 1, offsets: [0], match: MatchMode.Exact },
      ],
    });
  });

  it("refuses the batch at the first edit that does not match once", () => {
    expect(
      applyEdits("x y", [
        { oldString: "x", newString: "1" },
        { oldString: "nope", newString: "2" },
      ])
    ).toMatchObject({
      ok: false,
      index: 1,
      reason: ExactReplaceFailure.NotFound,
    });
  });
});
