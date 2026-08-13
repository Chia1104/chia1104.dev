import type { SessionTreeEntry } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage } from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "vitest";

import { foldEvents } from "../src/wire/fold.ts";
import { entriesToWireEvents } from "../src/wire/replay.ts";
import type { AgentWireEvent } from "../src/wire/schema.ts";

/**
 * The fold is shared by the live stream and the replayed transcript, so its invariants matter more
 * than usual: any divergence shows up as a UI that renders differently after a refresh.
 */

describe("foldEvents", () => {
  it("carries an arbitrary tier through, not just the writing agent's three", () => {
    const state = foldEvents([
      {
        type: "tool:start",
        toolCallId: "c1",
        toolName: "send_email",
        label: "Send email",
        // A tier this package has never heard of. `ToolTier` is a string precisely so a second
        // agent kind does not have to widen a union here.
        tier: "send",
        args: {},
      },
    ]);

    const tool = state.items.find((item) => item.kind === "tool");
    expect(tool).toMatchObject({ tier: "send", status: "running" });
  });

  it("keeps a gated call pending across the refusal that the gate produces", () => {
    // The gate refuses, and pi turns that refusal into an *error* tool result. That error is the
    // mechanism working, not a failure — so the approval prompt must survive it.
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
    // Replay omits deltas entirely — the coarse stream alone must produce the same view.
    expect(textOf(withDeltas.filter((e) => e.type !== "assistant:delta"))).toBe(
      "Hello"
    );
  });

  it("uses persisted entry ids when replaying assistant messages", () => {
    const entries: SessionTreeEntry[] = [
      {
        type: "message",
        id: "entry-1",
        parentId: null,
        timestamp: "2026-01-01T00:00:00.000Z",
        message: fauxAssistantMessage("First", { timestamp: 1 }),
      },
      {
        type: "message",
        id: "entry-2",
        parentId: "entry-1",
        timestamp: "2026-01-01T00:00:01.000Z",
        message: fauxAssistantMessage("Second", { timestamp: 2 }),
      },
    ];
    const presentation = {
      tierOf: () => "read",
      labelOf: (name: string) => name,
      summarize: () => "",
    };

    const all = entriesToWireEvents(entries, presentation).filter(
      (event) => event.type === "assistant:end"
    );
    const secondOnly = entriesToWireEvents(
      entries.slice(1),
      presentation
    ).filter((event) => event.type === "assistant:end");

    expect(all.map((event) => event.messageId)).toEqual([
      "a:entry-1",
      "a:entry-2",
    ]);
    expect(secondOnly[0]?.messageId).toBe("a:entry-2");
  });
});
