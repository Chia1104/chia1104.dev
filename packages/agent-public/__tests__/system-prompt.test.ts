import { describe, expect, it } from "vitest";

import { buildSystemPrompt, buildTurnContext } from "../src/prompts/system.ts";

describe("buildSystemPrompt", () => {
  it("appends the operator's instructions as the last section, and nothing when there are none", () => {
    const bare = buildSystemPrompt();
    expect(bare).not.toContain("# Operator instructions");
    expect(buildSystemPrompt({ instructions: "  \n" })).toBe(bare);

    const withRules = buildSystemPrompt({
      instructions: "Call the author Chia.",
    });
    expect(withRules.startsWith(bare)).toBe(true);
    expect(
      withRules.endsWith("# Operator instructions\n\nCall the author Chia.")
    ).toBe(true);
  });

  it("names every tool it tells the model to use", () => {
    const prompt = buildSystemPrompt();
    for (const name of [
      "search_posts",
      "get_post",
      "list_posts",
      "list_tags",
    ]) {
      expect(prompt).toContain(`\`${name}\``);
    }
  });
});

describe("buildTurnContext", () => {
  it("carries the clock and the site locale", () => {
    const context = buildTurnContext({
      defaultLocale: "en",
      now: new Date("2026-08-30T01:02:03.000Z"),
    });
    expect(context).toBe(
      [
        "# Current session",
        "- Current time: 2026-08-30T01:02:03.000Z (UTC)",
        "- Site default locale: en",
      ].join("\n")
    );
  });
});
