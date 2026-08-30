import type { Usage } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";

import {
  canCompactBranch,
  compactionContextWindow,
  shouldCompactBranch,
} from "../src/pi/compaction.ts";
import type { SessionEntry } from "../src/session/entries.ts";
import { estimateBranchContextTokens } from "../src/session/usage.ts";

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
const entry = <TMessage>(message: TMessage): SessionEntry => {
  seq += 1;
  return /* SAFETY: This fixture implements the SessionEntry members exercised by this case. */ {
    type: "message",
    id: `e${seq}`,
    parentId: seq === 1 ? null : `e${seq - 1}`,
    seq,
    timestamp: 1_767_225_600_000,
    message,
  } as SessionEntry;
};

const userEntry = (text: string) => entry({ role: "user", content: text });

const assistantEntry = (text: string, totalTokens?: number) =>
  entry({
    role: "assistant",
    content: [{ type: "text", text }],
    stopReason: "stop",
    usage: totalTokens === undefined ? undefined : usage(totalTokens),
  });

const compactionEntry = (retainedUsage?: number): SessionEntry => {
  seq += 1;
  return /* SAFETY: This fixture implements the SessionEntry members exercised by this case. */ {
    type: "compaction",
    id: `e${seq}`,
    parentId: `e${seq - 1}`,
    seq,
    timestamp: 1_767_225_600_000,
    summary: "Everything so far, condensed.",
    tokensBefore: 95_000,
    retainedTail:
      retainedUsage === undefined
        ? []
        : [
            {
              role: "assistant",
              content: [{ type: "text", text: "Recent answer" }],
              stopReason: "stop",
              usage: usage(retainedUsage),
            },
          ],
  } as SessionEntry;
};

describe("estimateBranchContextTokens", () => {
  it("uses provider usage on an uncompacted branch", () => {
    const branch = [userEntry("Write a post"), assistantEntry("Sure", 12_000)];
    expect(estimateBranchContextTokens(branch)).toBe(12_000);
  });

  it("does not reuse stale retained usage immediately after compaction", () => {
    const branch = [compactionEntry(95_000)];
    const tokens = estimateBranchContextTokens(branch);

    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(1_000);
  });

  it("uses fresh provider usage after the compacted branch advances", () => {
    const branch = [
      compactionEntry(95_000),
      userEntry("Carry on"),
      assistantEntry("Carrying on", 9_000),
    ];
    expect(estimateBranchContextTokens(branch)).toBe(9_000);
  });
});

/**
 * Pi keeps the newest ~20k tokens (`keepRecentTokens`) whole; only what lies before them is
 * summarised. An oversized message therefore lands in the kept tail and pushes everything
 * before it into the summarised part.
 */
describe("canCompactBranch", () => {
  it("declines an empty branch", () => {
    expect(canCompactBranch([])).toBe(false);
  });

  it("declines a branch that fits in the retained tail", () => {
    const branch = [userEntry("Write a post"), assistantEntry("Sure", 12_000)];
    expect(canCompactBranch(branch)).toBe(false);
  });

  it("declines when the oversized message is the oldest — the tail is the whole branch", () => {
    const branch = [userEntry("x".repeat(100_000)), assistantEntry("Sure")];
    expect(canCompactBranch(branch)).toBe(false);
  });

  it("accepts once older turns lie before the retained tail", () => {
    const branch = [
      userEntry("Old question"),
      assistantEntry("Old answer"),
      userEntry("x".repeat(100_000)),
      assistantEntry("Noted"),
    ];
    expect(canCompactBranch(branch)).toBe(true);
  });

  it("declines a branch that already ends in a compaction", () => {
    const branch = [
      userEntry("Old question"),
      assistantEntry("Old answer"),
      userEntry("x".repeat(100_000)),
      compactionEntry(),
    ];
    expect(canCompactBranch(branch)).toBe(false);
  });
});

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

describe("compactionContextWindow", () => {
  it("measures against the session model when the summariser is at least as large", () => {
    expect(
      compactionContextWindow(
        { contextWindow: 200_000 },
        { contextWindow: 200_000 }
      )
    ).toBe(200_000);
    expect(
      compactionContextWindow(
        { contextWindow: 200_000 },
        { contextWindow: 1_000_000 }
      )
    ).toBe(200_000);
  });

  it("brings compaction forward to what a smaller summariser can read", () => {
    expect(
      compactionContextWindow(
        { contextWindow: 1_000_000 },
        { contextWindow: 200_000 }
      )
    ).toBe(200_000);
  });
});
