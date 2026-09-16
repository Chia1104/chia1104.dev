import { describe, expect, it } from "vitest";

import { writingTurnBudget } from "@chia/agent-writing/policy";

import { publicPolicy, publicTurnBudget } from "../src/policy.ts";
import { TOOL_NAMES } from "../src/tools/registry.ts";

describe("publicPolicy", () => {
  it("classifies every tool as read and never asks for approval", () => {
    for (const name of [...Object.values(TOOL_NAMES), "not_a_tool"]) {
      const info = publicPolicy.toolInfo(name);
      expect(info.tier).toBe("read");
      expect(info.changes).toBeUndefined();
      expect(publicPolicy.requiresApproval(info.tier)).toBe(false);
    }
  });

  it("summarises a content read and an error", () => {
    expect(
      publicPolicy.summarize(
        TOOL_NAMES.searchPosts,
        { content: [], details: { hits: [{}, {}] } },
        false
      )
    ).toBe("2 match(es).");
    expect(
      publicPolicy.summarize(
        TOOL_NAMES.getPost,
        { content: [{ type: "text", text: "boom" }] },
        true
      )
    ).toBe("boom");
  });
});

/** The public budget is the cost boundary; it must stay strictly inside the author's. */
describe("publicTurnBudget", () => {
  it("is tighter than the writing budget on every axis", () => {
    expect(publicTurnBudget.maxToolCalls).toBeLessThan(
      writingTurnBudget.maxToolCalls
    );
    expect(publicTurnBudget.hardMaxToolCalls).toBeLessThan(
      writingTurnBudget.hardMaxToolCalls
    );
    expect(publicTurnBudget.maxRepeats).toBeLessThanOrEqual(
      writingTurnBudget.maxRepeats
    );
    expect(publicTurnBudget.maxDurationMs).toBeLessThan(
      writingTurnBudget.maxDurationMs
    );
    expect(publicTurnBudget.maxToolCalls).toBeLessThan(
      publicTurnBudget.hardMaxToolCalls
    );
  });
});
