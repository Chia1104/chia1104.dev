import { fauxAssistantMessage } from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "vitest";

import type { SessionEntry } from "../src/session/entries.ts";
import { DETAILS_MAX_STRING_CHARS } from "../src/wire/clip.ts";
import { foldEvents } from "../src/wire/fold.ts";
import { entriesToWireEvents } from "../src/wire/replay.ts";
import type { AgentWireEvent } from "../src/wire/schema.ts";

/**
 * The fold is shared by the live stream and the replayed transcript, so any divergence shows up
 * as a UI that renders differently after a refresh.
 */

const presentation = {
  tierOf: () => "read",
  labelOf: (name: string) => name,
  summarize: () => "",
};

const assistantWithCall = (
  id: string,
  parentId: string | null,
  stopReason: "toolUse" | "aborted"
): SessionEntry => ({
  type: "message",
  id,
  parentId,
  seq: 1,
  timestamp: 1,
  message: fauxAssistantMessage(
    [{ type: "toolCall", id: "call-1", name: "get_post", arguments: {} }],
    { stopReason, timestamp: 1 }
  ),
});

describe("foldEvents", () => {
  it("carries an arbitrary tier through, not just the writing agent's three", () => {
    const state = foldEvents([
      {
        type: "tool:start",
        toolCallId: "c1",
        toolName: "send_email",
        label: "Send email",
        // A tier this package has never heard of. `ToolTier` is a string so a second agent kind
        // does not have to widen a union here.
        tier: "send",
        args: {},
      },
    ]);

    const tool = state.items.find((item) => item.kind === "tool");
    expect(tool).toMatchObject({ tier: "send", status: "running" });
  });

  it("keeps a gated call pending across the refusal that the gate produces", () => {
    // The gate refuses, and pi turns that refusal into an error tool result. That error is the
    // mechanism working, not a failure, so the approval prompt must survive it.
    const events: AgentWireEvent[] = [
      {
        type: "tool:start",
        toolCallId: "c1",
        toolName: "commit",
        label: "Commit",
        tier: "commit",
        args: {},
      },
      {
        type: "approval:request",
        toolCallId: "c1",
        toolName: "commit",
        tier: "commit",
        args: {},
      },
      {
        type: "tool:end",
        toolCallId: "c1",
        toolName: "commit",
        isError: true,
        summary: "needs approval",
      },
    ];

    const state = foldEvents(events);
    expect(state.pendingApprovals.map((p) => p.toolCallId)).toEqual(["c1"]);
    const tool = state.items.find((item) => item.kind === "tool");
    expect(tool).toMatchObject({ status: "awaiting_approval" });
  });

  it("clears the approval once a decision arrives", () => {
    const state = foldEvents([
      {
        type: "approval:request",
        toolCallId: "c1",
        toolName: "commit",
        tier: "commit",
        args: {},
      },
      { type: "approval:resolved", toolCallId: "c1", approved: true },
    ]);

    expect(state.pendingApprovals).toHaveLength(0);
    expect(state.runStatus).toBe("running");
  });

  it("bumps stateRevision on a generic state:changed, whatever the scope", () => {
    const state = foldEvents([
      { type: "state:changed", scope: "draft", revision: 1 },
      { type: "state:changed", scope: "draft", revision: 2 },
    ]);
    expect(state.stateRevision).toBe(2);
  });

  it("reaches the same text with or without deltas", () => {
    const withDeltas: AgentWireEvent[] = [
      { type: "assistant:start", messageId: "a1" },
      {
        type: "assistant:delta",
        messageId: "a1",
        channel: "text",
        delta: "Hel",
      },
      {
        type: "assistant:delta",
        messageId: "a1",
        channel: "text",
        delta: "lo",
      },
      { type: "assistant:end", messageId: "a1", text: "Hello" },
    ];

    const textOf = (events: AgentWireEvent[]) =>
      foldEvents(events)
        .items.filter((item) => item.kind === "assistant")
        .map((item) => ("text" in item ? item.text : ""))
        .join("");

    expect(textOf(withDeltas)).toBe("Hello");
    // Replay omits deltas entirely; the coarse stream alone must produce the same view.
    expect(textOf(withDeltas.filter((e) => e.type !== "assistant:delta"))).toBe(
      "Hello"
    );
  });

  it("uses persisted entry ids when replaying assistant messages", () => {
    const entries: SessionEntry[] = [
      {
        type: "message",
        id: "entry-1",
        parentId: null,
        seq: 1,
        timestamp: 1_767_225_600_000,
        message: fauxAssistantMessage("First", { timestamp: 1 }),
      },
      {
        type: "message",
        id: "entry-2",
        parentId: "entry-1",
        seq: 2,
        timestamp: 1_767_225_601_000,
        message: fauxAssistantMessage("Second", { timestamp: 2 }),
      },
    ];
    const all = entriesToWireEvents(entries, presentation).filter(
      (event) => event.type === "assistant:end"
    );
    const secondOnly = entriesToWireEvents(
      entries.slice(1),
      presentation
    ).filter((event) => event.type === "assistant:end");

    expect(all.map((event) => event.messageId)).toEqual(["entry-1", "entry-2"]);
    expect(secondOnly[0]?.messageId).toBe("entry-2");
  });

  it("replays a branch summary as the rewind notice", () => {
    const entries: SessionEntry[] = [
      {
        type: "message",
        id: "entry-1",
        parentId: null,
        seq: 1,
        timestamp: 1_767_225_600_000,
        message: fauxAssistantMessage("Kept", { timestamp: 1 }),
      },
      {
        type: "branch_summary",
        id: "entry-2",
        parentId: "entry-1",
        seq: 2,
        timestamp: 1_767_225_601_000,
        fromId: "entry-1",
        summary: "A tangent about titles, abandoned.",
      },
    ];

    const events = entriesToWireEvents(entries, {
      tierOf: () => "read",
      labelOf: (name: string) => name,
      summarize: () => "",
    });

    expect(events.map((event) => event.type)).toEqual([
      "assistant:end",
      "session:rewound",
    ]);
    expect(foldEvents(events).items.at(-1)).toEqual({
      kind: "notice",
      variant: "rewound",
      text: "A tangent about titles, abandoned.",
    });
  });

  it("replays a failed assistant message as the same error notice the live turn emits", () => {
    const failed = fauxAssistantMessage("", { timestamp: 1 });
    failed.stopReason = "error";
    failed.errorMessage = "429 Too Many Requests";
    const entries: SessionEntry[] = [
      {
        type: "message",
        id: "entry-1",
        parentId: null,
        seq: 1,
        timestamp: 1_767_225_600_000,
        message: failed,
      },
    ];

    const events = entriesToWireEvents(entries, {
      tierOf: () => "read",
      labelOf: (name: string) => name,
      summarize: () => "",
    });

    expect(events.map((event) => event.type)).toEqual([
      "assistant:end",
      "error",
    ]);
    expect(events[1]).toEqual({ type: "error", kind: "rate_limited" });
    expect(foldEvents(events).items.at(-1)).toEqual({
      kind: "notice",
      variant: "error",
      code: "rate_limited",
    });
  });

  it("closes a call whose result never landed as aborted on replay", () => {
    const events = entriesToWireEvents(
      [
        assistantWithCall("a1", null, "toolUse"),
        {
          type: "message",
          id: "u2",
          parentId: "a1",
          seq: 2,
          timestamp: 2,
          message: { role: "user", content: "again", timestamp: 2 },
        },
      ],
      presentation
    );
    expect(events.map((event) => event.type)).toEqual([
      "assistant:end",
      "tool:start",
      "tool:end",
      "user",
    ]);
    expect(events[2]).toMatchObject({
      toolCallId: "call-1",
      isError: false,
      aborted: true,
    });
    const tool = foldEvents(events).items.find((item) => item.kind === "tool");
    expect(tool).toMatchObject({ status: "aborted" });
  });

  it("closes a call cut off at the end of the branch, as a fork at the message leaves it", () => {
    const events = entriesToWireEvents(
      [assistantWithCall("a1", null, "toolUse")],
      presentation
    );
    expect(events.map((event) => event.type)).toEqual([
      "assistant:end",
      "tool:start",
      "tool:end",
    ]);
  });

  it("shows no card for calls in a message the stop cut short, as the live turn did not", () => {
    const events = entriesToWireEvents(
      [assistantWithCall("a1", null, "aborted")],
      presentation
    );
    expect(events.map((event) => event.type)).toEqual(["assistant:end"]);
  });

  it("clips oversized tool details on replay while keeping their shape", () => {
    const body = "x".repeat(DETAILS_MAX_STRING_CHARS + 100);
    const entries: SessionEntry[] = [
      {
        type: "message",
        id: "entry-1",
        parentId: null,
        seq: 1,
        timestamp: 1_767_225_600_000,
        message: {
          role: "toolResult",
          toolCallId: "call-1",
          toolName: "get_post",
          content: [{ type: "text", text: "" }],
          details: { post: { slug: "hello", content: body } },
          isError: false,
          timestamp: 1,
        },
      },
    ];

    const [event] = entriesToWireEvents(entries, {
      tierOf: () => "read",
      labelOf: (name: string) => name,
      summarize: () => "",
    });

    expect(event?.type).toBe("tool:end");
    const details =
      /* SAFETY: This fixture implements the { details: { post: { slug: string; content: string } } } members exercised by this case. */ (
        event as { details: { post: { slug: string; content: string } } }
      ).details;
    expect(details.post.slug).toBe("hello");
    expect(details.post.content.length).toBeLessThan(body.length);
    expect(details.post.content).toContain("[truncated 100 chars]");
  });
});
