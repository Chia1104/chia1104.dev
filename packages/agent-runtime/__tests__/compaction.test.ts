import { describe, expect, it } from "vitest";

import {
  canCompactBranch,
  compactionContextWindow,
  serializeConversation,
  shouldCompactBranch,
} from "../src/compaction.ts";
import type { AgentMessage, AssistantMessage, Usage } from "../src/messages.ts";
import type { SessionEntry } from "../src/session/entries.ts";
import { estimateBranchContextTokens } from "../src/session/usage.ts";

import { assistantMessage } from "./runtime.fixture.ts";

/**
 * Compaction runs once context exceeds `contextWindow - 16_384`. These tests pick a 100k window
 * so the boundary sits at 83,616.
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

const TIMESTAMP = 1_767_225_600_000;

let seq = 0;
const entry = (message: AgentMessage): SessionEntry => {
  seq += 1;
  return {
    type: "message",
    id: `e${seq}`,
    parentId: seq === 1 ? null : `e${seq - 1}`,
    seq,
    timestamp: TIMESTAMP,
    message,
  };
};

const userEntry = (text: string) =>
  entry({ role: "user", content: text, timestamp: TIMESTAMP });

const reply = (text: string, totalTokens?: number): AssistantMessage => ({
  ...assistantMessage(text, TIMESTAMP),
  ...(totalTokens !== undefined && { usage: usage(totalTokens) }),
});

const assistantEntry = (text: string, totalTokens?: number) =>
  entry(reply(text, totalTokens));

const toolResultEntry = (text: string) =>
  entry({
    role: "toolResult",
    toolCallId: "call-1",
    toolName: "search",
    content: [{ type: "text", text }],
    isError: false,
    timestamp: TIMESTAMP,
  });

const compactionEntry = (retainedUsage?: number): SessionEntry => {
  seq += 1;
  return {
    type: "compaction",
    id: `e${seq}`,
    parentId: `e${seq - 1}`,
    seq,
    timestamp: TIMESTAMP,
    summary: "Everything so far, condensed.",
    tokensBefore: 95_000,
    retainedTail:
      retainedUsage === undefined
        ? []
        : [reply("Recent answer", retainedUsage)],
  };
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

  it("does not trust the usage of a reply the provider never completed", () => {
    const failed: AssistantMessage = {
      ...reply("", 90_000),
      stopReason: "error",
    };
    const branch = [
      userEntry("Go"),
      assistantEntry("Working", 5_000),
      entry(failed),
    ];
    expect(estimateBranchContextTokens(branch)).toBe(5_000);
  });
});

/**
 * The newest ~20k tokens are kept whole and only what lies before them is summarised. A message
 * that alone overflows that tail is summarised with everything older.
 */
describe("canCompactBranch", () => {
  it("declines an empty branch", () => {
    expect(canCompactBranch([])).toBe(false);
  });

  it("declines a branch that fits in the retained tail", () => {
    const branch = [userEntry("Write a post"), assistantEntry("Sure", 12_000)];
    expect(canCompactBranch(branch)).toBe(false);
  });

  it("declines when the newest message alone overflows the tail: nothing newer could be kept", () => {
    const branch = [
      userEntry("Old question"),
      assistantEntry("Old answer"),
      userEntry("x".repeat(100_000)),
    ];
    expect(canCompactBranch(branch)).toBe(false);
  });

  it("summarises an oversized oldest message that cannot fit the tail", () => {
    const branch = [userEntry("x".repeat(100_000)), assistantEntry("Sure")];
    expect(canCompactBranch(branch)).toBe(true);
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

  it("never starts the tail at a tool result, which would lose the call it answers", () => {
    // The tail could hold the result alone, but the reply that made the call overflows it, so
    // there is nothing to keep.
    const call: AssistantMessage = {
      ...reply(""),
      content: [
        { type: "text", text: "x".repeat(100_000) },
        { type: "toolCall", id: "call-1", name: "search", arguments: {} },
      ],
      stopReason: "toolUse",
    };
    const branch = [
      userEntry("Old question"),
      assistantEntry("Old answer"),
      userEntry("Look it up"),
      entry(call),
      toolResultEntry("results"),
    ];
    expect(canCompactBranch(branch)).toBe(false);
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
   * Workflow-retry hazard: a retried step can re-run a turn whose compaction already landed. The
   * branch it sees starts at the compaction entry, and the reply usage after it reflects the
   * post-compaction context, so the threshold says no and the second compaction never happens.
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
    // Post-turn, tool results and user text sit past the newest reply's usage.
    const trailing = "x".repeat(40_000); // ~10k tokens at four characters a token
    const branch = [
      userEntry("Go"),
      assistantEntry("Working", 80_000),
      userEntry(trailing),
    ];
    expect(shouldCompactBranch(branch, CONTEXT_WINDOW)).toBe(true);
  });

  it("falls back to estimation before any reply usage exists", () => {
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

describe("serializeConversation", () => {
  it("renders the conversation as labelled text for a summariser to read, not continue", () => {
    const call: AssistantMessage = {
      ...reply("Let me look."),
      content: [
        { type: "thinking", thinking: "Private reasoning." },
        { type: "text", text: "Let me look." },
        {
          type: "toolCall",
          id: "call-1",
          name: "search",
          arguments: { q: "hono" },
        },
      ],
    };

    expect(
      serializeConversation([
        { role: "user", content: "Find hono posts", timestamp: TIMESTAMP },
        call,
        {
          role: "toolResult",
          toolCallId: "call-1",
          toolName: "search",
          content: [{ type: "text", text: "not found" }],
          isError: true,
          timestamp: TIMESTAMP,
        },
      ])
    ).toBe(
      [
        "[User]: Find hono posts",
        "[Assistant]: Let me look.",
        '[Assistant tool call]: search({"q":"hono"})',
        "[Tool result (error)]: not found",
      ].join("\n\n")
    );
  });
});
