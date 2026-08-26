import { describe, expect, it } from "vitest";

import { emptyDraft } from "../src/draft/operations.ts";
import { buildTurnContext } from "../src/prompts/system.ts";

const base = {
  draft: emptyDraft(),
  defaultLocale: "zh-TW" as const,
  now: new Date("2026-08-27T00:00:00Z"),
};

describe("buildTurnContext memories", () => {
  it("omits the section when the session has saved nothing", () => {
    expect(buildTurnContext({ ...base, sessionMemories: [] })).not.toContain(
      "Memories saved"
    );
  });

  it("lists each memory on one bounded line with its id", () => {
    const context = buildTurnContext({
      ...base,
      sessionMemories: [
        {
          id: 41,
          kind: "source",
          title: "pgvector\nREADME  ",
          sourceUrl: "https://x/",
        },
        { id: 42, kind: "fact", title: "x".repeat(200), sourceUrl: null },
      ],
    });

    expect(context).toContain("  - [source] pgvector README (#41)");
    const factLine = context.split("\n").find((line) => line.includes("(#42)"));
    expect(factLine).toBeDefined();
    expect(factLine).toContain("…");
    // 2 spaces, "- [fact] ", 119 chars + ellipsis, " (#42)"
    expect(factLine?.length).toBe("  - [fact] ".length + 120 + " (#42)".length);
  });

  it("puts active lessons in their own always-on section", () => {
    const context = buildTurnContext({
      ...base,
      lessons: [
        {
          id: 7,
          kind: "lesson",
          title: "Open with the problem, not the tool",
          sourceUrl: null,
        },
      ],
    });

    expect(context).toContain("# Learned preferences");
    expect(context).toContain("- Open with the problem, not the tool (#7)");
    expect(buildTurnContext({ ...base, lessons: [] })).not.toContain(
      "Learned preferences"
    );
  });
});
