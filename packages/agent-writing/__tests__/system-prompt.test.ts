import { describe, expect, it } from "vitest";

import { buildSystemPrompt } from "../src/prompts/system.ts";

describe("buildSystemPrompt", () => {
  it("appends the operator's instructions as the last section, and nothing when there are none", () => {
    const bare = buildSystemPrompt({ skills: [], autoApprove: [] });
    expect(bare).not.toContain("# Operator instructions");
    expect(
      buildSystemPrompt({ skills: [], autoApprove: [], instructions: "  \n" })
    ).toBe(bare);

    const withRules = buildSystemPrompt({
      skills: [],
      autoApprove: [],
      instructions: "Keep intros under three sentences.",
    });
    expect(withRules.startsWith(bare)).toBe(true);
    expect(
      withRules.endsWith(
        "# Operator instructions\n\nKeep intros under three sentences."
      )
    ).toBe(true);
  });
});

describe("buildSystemPrompt GitHub access", () => {
  it("names the allowed repositories, or says none are", () => {
    const none = buildSystemPrompt({ skills: [], autoApprove: [] });
    expect(none).toContain("No repositories are allowed");

    const some = buildSystemPrompt({
      skills: [],
      autoApprove: [],
      githubRepos: ["chia1104/chia1104.dev", "chia1104/notes"],
    });
    expect(some).toContain("- chia1104/chia1104.dev\n- chia1104/notes");
    expect(some).not.toContain("No repositories are allowed");
  });
});
