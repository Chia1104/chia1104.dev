import { describe, expect, it } from "vitest";

import { foldEvents } from "../src/wire/fold.ts";
import type { AgentWireEvent } from "../src/wire/schema.ts";

const toolStart: AgentWireEvent = {
  type: "tool:start",
  toolCallId: "call-1",
  toolName: "commit_draft",
  label: "Commit draft",
  tier: "commit",
  args: {},
};
const request: AgentWireEvent = {
  type: "approval:request",
  toolCallId: "call-1",
  toolName: "commit_draft",
  tier: "commit",
  args: {},
};
const refusal: AgentWireEvent = {
  type: "tool:end",
  toolCallId: "call-1",
  toolName: "commit_draft",
  isError: true,
  summary: "needs approval",
};

const toolOf = (events: AgentWireEvent[]) => {
  const view = foldEvents(events);
  const tool = view.items.find((item) => item.kind === "tool");
  if (tool?.kind !== "tool") throw new Error("no tool item");
  return { view, tool };
};

describe("approval fold", () => {
  it("keeps the card awaiting when the gate's refusal lands after the announcement", () => {
    const { view, tool } = toolOf([
      toolStart,
      request,
      refusal,
      { type: "run:end", reason: "awaiting_approval" },
    ]);
    expect(tool.status).toBe("awaiting_approval");
    expect(view.pendingApprovals.map((pending) => pending.toolCallId)).toEqual([
      "call-1",
    ]);
    expect(view.runStatus).toBe("awaiting_approval");
  });

  it("does not make the request decidable before the turn has handed back", () => {
    const { view, tool } = toolOf([
      { type: "run:start", sessionId: "s" },
      toolStart,
      request,
      refusal,
    ]);
    // Announced and visible, but the row is not persisted yet — the card must stay locked.
    expect(tool.status).toBe("awaiting_approval");
    expect(view.runStatus).toBe("running");
  });

  it("closes the card on the relayed decision and renders the relay as a notice", () => {
    const { view, tool } = toolOf([
      toolStart,
      request,
      refusal,
      { type: "run:end", reason: "awaiting_approval" },
      { type: "run:start", sessionId: "s" },
      {
        type: "approval:resolved",
        toolCallId: "call-1",
        approved: true,
        comment: "go",
      },
      {
        type: "user",
        messageId: "u:2",
        text: "Operator decision: approved `commit_draft`. Run it now.",
        origin: "operator-decision",
      },
    ]);
    expect(tool.status).toBe("ok");
    expect(tool.approval).toEqual({ approved: true, comment: "go" });
    expect(view.pendingApprovals).toEqual([]);
    expect(view.items.at(-1)).toMatchObject({
      kind: "notice",
      variant: "decision",
    });
    expect(view.items.some((item) => item.kind === "user")).toBe(false);
  });

  it("retracts an announced request when the turn ends any other way", () => {
    const { view, tool } = toolOf([
      toolStart,
      request,
      refusal,
      { type: "error", kind: "internal" },
      { type: "run:end", reason: "error" },
    ]);
    expect(tool.status).toBe("error");
    expect(view.pendingApprovals).toEqual([]);
    expect(view.runStatus).toBe("error");
  });
});

describe("stopped turns", () => {
  it("closes a call still running when the turn ends without its result", () => {
    const { view, tool } = toolOf([
      { type: "run:start", sessionId: "s" },
      toolStart,
      { type: "run:end", reason: "aborted" },
    ]);
    expect(tool.status).toBe("aborted");
    expect(view.runStatus).toBe("idle");
  });

  it("renders a replayed aborted result as stopped, not failed", () => {
    const { tool } = toolOf([
      toolStart,
      {
        type: "tool:end",
        toolCallId: "call-1",
        toolName: "commit_draft",
        isError: false,
        aborted: true,
        summary: "",
      },
    ]);
    expect(tool.status).toBe("aborted");
  });
});
