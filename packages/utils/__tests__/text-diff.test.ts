import { describe, expect, it } from "vitest";

import { applyEdits } from "../src/text";
import { lineChangesOf, textChangesOf, toEdits } from "../src/text/diff";

const land = (content: string, before: string, after: string) =>
  applyEdits(content, toEdits(before, after), { exactOnly: true });

/** Deterministic stand-in for a property test: small alphabets make repeated lines common. */
const sequence = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
};
const LINES = ["", "a", "b", "## h", "---", "para one", "para two", "段落"];
const randomText = (random: () => number) => {
  const count = 1 + Math.floor(random() * 12);
  const lines = Array.from(
    { length: count },
    () => LINES[Math.floor(random() * LINES.length)]!
  );
  return lines.join("\n") + (random() < 0.5 ? "\n" : "");
};

describe("toEdits", () => {
  it("is empty for equal texts and refuses a text with nothing to anchor on", () => {
    expect(toEdits("same\n", "same\n")).toEqual([]);
    expect(() => toEdits("", "new")).toThrow();
  });

  it("turns one text into the other, whatever repeats in it", () => {
    const random = sequence(20_260_917);
    for (let round = 0; round < 3000; round += 1) {
      const before = randomText(random);
      const after = randomText(random);
      if (before.length === 0) continue;
      const result = land(before, before, after);
      expect(
        result,
        `${JSON.stringify(before)} → ${JSON.stringify(after)}`
      ).toMatchObject({
        ok: true,
        content: after,
      });
    }
  });

  it("widens a target that repeats until it names one place", () => {
    const before = "- item\n\n- item\n\n- item\n";
    const after = "- item\n\n- changed\n\n- item\n";
    const edits = toEdits(before, after);
    expect(edits).toHaveLength(1);
    expect(land(before, before, after)).toMatchObject({ content: after });
  });

  const body = [
    "# Title",
    "",
    "Intro paragraph.",
    "",
    "## Section A",
    "",
    "Text of A.",
    "",
    "## Section B",
    "",
    "Text of B.",
    "",
  ].join("\n");

  it("lands on a body someone else changed elsewhere", () => {
    const mine = body.replace("Text of B.", "Text of B, extended by me.");
    const theirs = body.replace(
      "Intro paragraph.",
      "Intro, rewritten by them."
    );
    expect(land(theirs, body, mine)).toMatchObject({
      ok: true,
      content: theirs.replace("Text of B.", "Text of B, extended by me."),
    });
  });

  it("refuses a body changed in the same place, and writes nothing", () => {
    const mine = body.replace("Text of A.", "Text of A, by me.");
    const theirs = body.replace("Text of A.", "Text of A, by them.");
    expect(land(theirs, body, mine)).toMatchObject({
      ok: false,
      reason: "not_found",
    });
  });

  it("refuses rather than guesses when the other side duplicated the target", () => {
    const mine = body.replace("Text of B.", "Text of B!");
    const theirs = `${body}\n## Section B\n\nText of B.\n`;
    expect(land(theirs, body, mine)).toMatchObject({
      ok: false,
      reason: "ambiguous",
    });
  });

  it("matches byte for byte only", () => {
    expect(
      applyEdits("say “hi”  \n", [{ oldString: 'say "hi"', newString: "x" }], {
        exactOnly: true,
      })
    ).toMatchObject({ ok: false, reason: "not_found" });
  });
});

describe("lineChangesOf", () => {
  const before = "one\ntwo\nthree\nfour\n";

  it("is empty for equal texts", () => {
    expect(lineChangesOf(before, before)).toEqual([]);
  });

  it("marks added lines where they now are", () => {
    expect(
      lineChangesOf(before, "one\ntwo\nnew a\nnew b\nthree\nfour\n")
    ).toEqual([{ kind: "added", startLine: 3, endLine: 4 }]);
  });

  it("marks a replaced run as modified over the lines that replaced it", () => {
    expect(lineChangesOf(before, "one\nTWO\nTWO again\nthree\nfour\n")).toEqual(
      [{ kind: "modified", startLine: 2, endLine: 3 }]
    );
  });

  it("marks a deletion on the line that follows it, or below the last line", () => {
    expect(lineChangesOf(before, "one\nfour\n")).toEqual([
      { kind: "deleted", startLine: 2, endLine: 2 },
    ]);
    expect(lineChangesOf("one\ntwo\nthree", "one")).toEqual([
      { kind: "modified", startLine: 1, endLine: 1 },
    ]);
    expect(lineChangesOf("one\ntwo\nthree\n", "one\n")).toEqual([
      { kind: "deleted", startLine: 2, endLine: 2 },
    ]);
  });

  it("reports several changes in document order", () => {
    expect(lineChangesOf(before, "zero\none\ntwo!\nthree\n")).toEqual([
      { kind: "added", startLine: 1, endLine: 1 },
      { kind: "modified", startLine: 3, endLine: 3 },
      { kind: "deleted", startLine: 5, endLine: 5 },
    ]);
  });
});

describe("textChangesOf", () => {
  const apply = (before: string, after: string) => {
    let result = before;
    // Offsets are in `before`, so later changes go first.
    for (const change of textChangesOf(before, after).toReversed()) {
      result =
        result.slice(0, change.start) + change.text + result.slice(change.end);
    }
    return result;
  };

  it("turns one text into the other, whatever repeats in it", () => {
    const random = sequence(7);
    for (let round = 0; round < 3000; round += 1) {
      const before = randomText(random);
      const after = randomText(random);
      expect(
        apply(before, after),
        `${JSON.stringify(before)} → ${JSON.stringify(after)}`
      ).toBe(after);
    }
    expect(apply("", "new body\n")).toBe("new body\n");
    expect(apply("old body\n", "")).toBe("");
  });

  it("touches only the characters that differ inside a changed line", () => {
    expect(
      textChangesOf(
        "第一段，前半句。後半句不變。\n\n第二段\n",
        "第一段，改過的前半句。後半句不變。\n\n第二段\n"
      )
    ).toEqual([{ start: 4, end: 4, text: "改過的" }]);
  });

  it("reports far apart changes separately and leaves the text between them alone", () => {
    const before = "one\ntwo\nthree\nfour\nfive\n";
    const changes = textChangesOf(before, "ONE\ntwo\nthree\nfour\nfive!\n");
    expect(changes).toEqual([
      { start: 0, end: 3, text: "ONE" },
      { start: 23, end: 23, text: "!" },
    ]);
  });
});
