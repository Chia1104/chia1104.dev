import { describe, expect, it } from "vitest";

import type { AssistantMessage } from "../src/messages.ts";
import { buildBranchContext } from "../src/session/context.ts";
import type { SessionEntry } from "../src/session/entries.ts";
import { InMemorySessionTree } from "../src/session/tree.ts";

import { assistantMessage } from "./runtime.fixture.ts";

/**
 * The projection is what the provider sees, and the provider's cached prefix survives only if
 * the next turn's projection starts with exactly the bytes the previous turn sent. These pin
 * that the projection is a pure function of the branch, so persistence never drifts from what
 * was sent.
 */

const API = "scripted";

// Fixtures carry a seq so they can stand in a branch literal; the in-memory tree assigns its
// own.
let seq = 0;

const user = (
  id: string,
  parentId: string | null,
  text: string
): SessionEntry => ({
  type: "message",
  id,
  parentId,
  seq: ++seq,
  timestamp: 1,
  message: { role: "user", content: [{ type: "text", text }], timestamp: 1 },
});

const assistant = (
  id: string,
  parentId: string | null,
  text: string,
  message: AssistantMessage = assistantMessage(text, 2)
): SessionEntry => ({
  type: "message",
  id,
  parentId,
  seq: ++seq,
  timestamp: 2,
  message,
});

const toolResult = (
  id: string,
  parentId: string,
  toolCallId: string,
  text: string,
  isError = false
): SessionEntry => ({
  type: "message",
  id,
  parentId,
  seq: ++seq,
  timestamp: 3,
  message: {
    role: "toolResult",
    toolCallId,
    toolName: "search",
    content: [{ type: "text", text }],
    details: { private: "for clients only" },
    isError,
    timestamp: 3,
  },
});

const withCalls = (...ids: string[]): AssistantMessage => ({
  ...assistantMessage("", 2),
  content: ids.map((id) => ({
    type: "toolCall",
    id,
    name: "search",
    arguments: { q: id },
  })),
  stopReason: "toolUse",
});

const project = (entries: readonly SessionEntry[]) =>
  buildBranchContext(entries, { api: API });

const serialize = (entries: readonly SessionEntry[]) =>
  JSON.stringify(project(entries));

describe("buildBranchContext", () => {
  it("is deterministic for the same branch", () => {
    const branch = [user("u1", null, "Hi"), assistant("a1", "u1", "Hello")];
    expect(serialize(branch)).toBe(serialize(branch));
  });

  it("extends the previous projection byte for byte when a turn appends", async () => {
    const session = new InMemorySessionTree("s");
    await session.appendEntry(user("u1", null, "Hi"));
    await session.appendEntry(assistant("a1", "u1", "Hello"));
    const before = project(await session.getBranch());

    await session.appendEntry(user("u2", "a1", "More"));
    await session.appendEntry(assistant("a2", "u2", "Sure"));
    const after = project(await session.getBranch());

    expect(JSON.stringify(after.slice(0, before.length))).toBe(
      JSON.stringify(before)
    );
    expect(after).toHaveLength(before.length + 2);
  });

  it("drops replies the provider never completed, in the branch and in a retained tail", () => {
    const aborted: AssistantMessage = {
      ...assistantMessage("Half an ans", 3),
      stopReason: "aborted",
    };
    const failed: AssistantMessage = {
      ...assistantMessage("", 4),
      stopReason: "error",
      errorMessage: "overloaded",
    };
    const branch: SessionEntry[] = [
      user("u1", null, "Hi"),
      assistant("a1", "u1", "", aborted),
      user("u2", "a1", "Again"),
      assistant("a2", "u2", "", failed),
      {
        type: "compaction",
        id: "c1",
        parentId: "a2",
        seq: ++seq,
        timestamp: 5,
        summary: "Condensed.",
        tokensBefore: 1_000,
        retainedTail: [aborted, assistantMessage("Done", 6)],
      },
      user("u3", "c1", "More"),
      assistant("a3", "u3", "", aborted),
    ];

    expect(project(branch)).toEqual([
      { role: "user", content: expect.stringContaining("Condensed.") },
      { role: "assistant", content: "Done" },
      { role: "user", content: [{ type: "text", content: "More" }] },
    ]);
  });

  it("projects a compaction as its summary plus the retained tail, dropping what came before", () => {
    const branch: SessionEntry[] = [
      user("u1", null, "Long ago"),
      assistant("a1", "u1", "Forgotten"),
      {
        type: "compaction",
        id: "c1",
        parentId: "a1",
        seq: ++seq,
        timestamp: 6,
        summary: "Everything so far.",
        tokensBefore: 90_000,
        retainedTail: [assistantMessage("Recent answer", 5)],
      },
      user("u2", "c1", "After"),
    ];

    const messages = project(branch);

    expect(JSON.stringify(messages)).not.toContain("Forgotten");
    // The summary is a user message of its own ahead of the retained tail.
    expect(messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "user",
    ]);
    expect(messages[0]?.content).toContain(
      "<summary>\nEverything so far.\n</summary>"
    );
  });

  it("projects a branch summary as a user message and skips an empty one", () => {
    const summary = (id: string, text: string): SessionEntry => ({
      type: "branch_summary",
      id,
      parentId: "a1",
      seq: ++seq,
      timestamp: 3,
      fromId: "a1",
      summary: text,
    });
    const branch = [
      user("u1", null, "Hi"),
      assistant("a1", "u1", "Hello"),
      summary("b1", "A tangent about titles."),
      summary("b2", ""),
    ];

    const messages = project(branch);

    expect(messages).toHaveLength(3);
    expect(messages[2]).toMatchObject({ role: "user" });
    expect(messages[2]?.content).toContain(
      "<summary>\nA tangent about titles.\n</summary>"
    );
  });

  it("hands the model a tool result's text, never its details, and marks a failed one", () => {
    const branch = [
      user("u1", null, "Search"),
      assistant("a1", "u1", "", withCalls("call-1", "call-2")),
      toolResult("r1", "a1", "call-1", "results"),
      toolResult("r2", "r1", "call-2", "search is down", true),
    ];

    const messages = project(branch);

    expect(messages[1]).toEqual({
      role: "assistant",
      content: null,
      toolCalls: [
        {
          id: "call-1",
          type: "function",
          function: { name: "search", arguments: '{"q":"call-1"}' },
        },
        {
          id: "call-2",
          type: "function",
          function: { name: "search", arguments: '{"q":"call-2"}' },
        },
      ],
    });
    expect(messages.slice(2)).toEqual([
      { role: "tool", toolCallId: "call-1", content: "results" },
      {
        role: "tool",
        toolCallId: "call-2",
        content: "search is down",
        error: "search is down",
      },
    ]);
    expect(JSON.stringify(messages)).not.toContain("for clients only");
  });

  it("answers a call its turn stopped before running, right after the results it has", () => {
    const branch = [
      user("u1", null, "Search"),
      assistant("a1", "u1", "", withCalls("call-1", "call-2")),
      toolResult("r1", "a1", "call-1", "results"),
      user("u2", "r1", "Never mind"),
    ];

    expect(project(branch).map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "tool",
      "tool",
      "user",
    ]);
    expect(project(branch)[3]).toMatchObject({
      role: "tool",
      toolCallId: "call-2",
      error: expect.stringContaining("did not complete"),
    });
  });

  it("leaves a call waiting on the operator unanswered, so the engine can still run it", () => {
    const branch = [
      user("u1", null, "Publish"),
      assistant("a1", "u1", "", withCalls("call-1", "call-2")),
      toolResult("r1", "a1", "call-1", "refused"),
    ];

    const messages = buildBranchContext(branch, {
      api: API,
      pendingToolCallIds: new Set(["call-2"]),
    });

    expect(messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "tool",
    ]);
  });

  describe("reasoning", () => {
    const thinkingReply = (
      api: string,
      signature: string | undefined
    ): AssistantMessage => ({
      ...assistantMessage("Answer.", 2),
      api,
      content: [
        {
          type: "thinking",
          thinking: "Because.",
          ...(signature !== undefined && { thinkingSignature: signature }),
        },
        { type: "text", text: "Answer." },
      ],
    });

    const projectedThinking = (message: AssistantMessage) => {
      const [, projected] = project([
        user("u1", null, "Why?"),
        assistant("a1", "u1", "", message),
      ]);
      return projected?.role === "assistant" ? projected.thinking : undefined;
    };

    it("sends signed reasoning back to the wire that signed it", () => {
      expect(projectedThinking(thinkingReply(API, "sig-1"))).toEqual([
        { content: "Because.", signature: "sig-1" },
      ]);
    });

    it("drops reasoning another wire signed", () => {
      expect(
        projectedThinking(thinkingReply("anthropic:messages", "sig-1"))
      ).toBeUndefined();
    });

    it("drops reasoning that carries no signature", () => {
      expect(projectedThinking(thinkingReply(API, undefined))).toBeUndefined();
    });
  });
});
