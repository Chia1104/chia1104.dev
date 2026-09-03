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

  it("places the profile between the rules and the instructions, and skips it when empty", () => {
    const bare = buildSystemPrompt();
    expect(bare).not.toContain("# About the author");
    expect(buildSystemPrompt({ profile: null })).toBe(bare);
    expect(buildSystemPrompt({ profile: " \n" })).toBe(bare);

    const prompt = buildSystemPrompt({
      profile: "### Frontend engineer",
      instructions: "Call the author Chia.",
    });
    const profileAt = prompt.indexOf(
      "# About the author\n\n### Frontend engineer"
    );
    expect(profileAt).toBeGreaterThan(bare.length - 1);
    expect(profileAt).toBeLessThan(prompt.indexOf("# Operator instructions"));
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
