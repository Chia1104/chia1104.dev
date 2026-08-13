import type { SessionTreeEntry } from "@earendil-works/pi-agent-core";
import type { Usage } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";

import { shouldCompactBranch } from "../src/pi/compaction.ts";

/**
 * The threshold is pi's: compact once context exceeds `contextWindow - reserveTokens`, where the
 * default reserve is 16,384. These tests pick a 100k window so the boundary sits at ~83,616.
 */
const CONTEXT_WINDOW = 100_000;

const usage = (totalTokens: number): Usage => ({
  input: totalTokens,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
});

let seq = 0;
const entry = (message: unknown): SessionTreeEntry => {
  seq += 1;
  return {
    type: "message",
    id: `e${seq}`,
    parentId: seq === 1 ? null : `e${seq - 1}`,
    timestamp: "2026-01-01T00:00:00.000Z",
    message,
  } as SessionTreeEntry;
};

const userEntry = (text: string) => entry({ role: "user", content: text });

const assistantEntry = (text: string, totalTokens?: number) =>
  entry({
    role: "assistant",
    content: [{ type: "text", text }],
    stopReason: "stop",
    ...(totalTokens === undefined ? {} : { usage: usage(totalTokens) }),
  });

const compactionEntry = (): SessionTreeEntry => {
  seq += 1;
  return {
    type: "compaction",
    id: `e${seq}`,
    parentId: `e${seq - 1}`,
    timestamp: "2026-01-01T00:00:00.000Z",
    summary: "Everything so far, condensed.",
    tokensBefore: 95_000,
  } as SessionTreeEntry;
};

describe("shouldCompactBranch", () => {
  it("declines on an empty branch", () => {
    expect(shouldCompactBranch([], CONTEXT_WINDOW)).toBe(false);
  });

  it("declines when the provider's reported usage is well inside the window", () => {
    const branch = [userEntry("Write a post"), assistantEntry("Sure", 12_000)];
    expect(shouldCompactBranch(branch, CONTEXT_WINDOW)).toBe(false);
  });

  it("compacts once reported usage crosses the reserve boundary", () => {
    const branch = [userEntry("Write a post"), assistantEntry("Sure", 90_000)];
    expect(shouldCompactBranch(branch, CONTEXT_WINDOW)).toBe(true);
  });

  it("uses the newest usage rather than the largest", () => {
    // A rewind or compaction can leave a heavier turn behind the current head.
    const branch = [
      userEntry("Long thread"),
      assistantEntry("Big", 90_000),
      userEntry("Start over"),
      assistantEntry("Small", 5_000),
    ];
    expect(shouldCompactBranch(branch, CONTEXT_WINDOW)).toBe(false);
  });

  /**
   * The workflow-retry hazard: `runAgentTurnStep` is a durable step, so a retry can re-run a turn
   * whose compaction already landed. The branch it sees starts at the compaction entry, and the
   * assistant usage after it reflects the *post*-compaction context — so the threshold says no and
   * the second compaction never happens. No extra bookkeeping needed.
   */
  it("does not compact again right after a compaction", () => {
    const branch = [
      compactionEntry(),
      userEntry("Carry on"),
      assistantEntry("Carrying on", 9_000),
    ];
    expect(shouldCompactBranch(branch, CONTEXT_WINDOW)).toBe(false);
  });

  it("counts messages that landed after the last reported usage", () => {
    // Post-turn, tool results and user text sit past the newest assistant usage block.
    const trailing = "x".repeat(40_000); // ~10k tokens on pi's chars/4 heuristic
    const branch = [
      userEntry("Go"),
      assistantEntry("Working", 80_000),
      userEntry(trailing),
    ];
    expect(shouldCompactBranch(branch, CONTEXT_WINDOW)).toBe(true);
  });

  it("falls back to estimation before any assistant usage exists", () => {
    const branch = [userEntry("hi")];
    expect(shouldCompactBranch(branch, CONTEXT_WINDOW)).toBe(false);

    const huge = [userEntry("x".repeat(400_000))];
    expect(shouldCompactBranch(huge, CONTEXT_WINDOW)).toBe(true);
  });
});
