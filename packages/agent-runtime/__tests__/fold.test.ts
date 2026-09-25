import { describe, expect, it } from "vitest";

import { AgentErrorKind } from "../src/types.ts";
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
const awaiting: AgentWireEvent = {
  type: "run:end",
  reason: "awaiting_approval",
};
const toolEnd = (isError: boolean): AgentWireEvent => ({
  type: "tool:end",
  toolCallId: "call-1",
  toolName: "commit_draft",
  isError,
  summary: isError ? "declined" : "committed",
});

const toolOf = (events: AgentWireEvent[]) => {
  const view = foldEvents(events);
  const tools = view.items.filter((item) => item.kind === "tool");
  const [tool] = tools;
  if (tool?.kind !== "tool") throw new Error("no tool item");
  return { view, tool, tools };
};

describe("approval fold", () => {
  it("parks the card on the recorded request once the turn hands back", () => {
    const { view, tool } = toolOf([
      { type: "run:start", sessionId: "s" },
      toolStart,
      request,
      awaiting,
    ]);
    expect(tool.status).toBe("awaiting_approval");
    expect(view.pendingApprovals.map((pending) => pending.toolCallId)).toEqual([
      "call-1",
    ]);
    expect(view.runStatus).toBe("awaiting_approval");
  });

  it("leaves the run status to the turn's end, not the announcement", () => {
    const { view, tool } = toolOf([
      { type: "run:start", sessionId: "s" },
      toolStart,
      request,
    ]);
    expect(tool.status).toBe("awaiting_approval");
    expect(view.runStatus).toBe("running");
  });

  it("records the decision and leaves the card for the resumed call's result", () => {
    const { view, tool } = toolOf([
      toolStart,
      request,
      awaiting,
      { type: "run:start", sessionId: "s" },
      {
        type: "approval:resolved",
        toolCallId: "call-1",
        approved: true,
        comment: "go",
      },
    ]);
    // Decided, not yet run.
    expect(tool.status).toBe("awaiting_approval");
    expect(tool.approval).toEqual({ approved: true, comment: "go" });
    expect(view.pendingApprovals).toEqual([]);
    expect(view.runStatus).toBe("running");
  });

  it("settles an approved call on its result, under the id it was requested with", () => {
    const { view, tool, tools } = toolOf([
      toolStart,
      request,
      awaiting,
      { type: "run:start", sessionId: "s" },
      {
        type: "approval:resolved",
        toolCallId: "call-1",
        approved: true,
        comment: "go",
      },
      toolEnd(false),
      { type: "run:end", reason: "done" },
    ]);
    expect(tools).toHaveLength(1);
    expect(tool).toMatchObject({
      status: "ok",
      summary: "committed",
      approval: { approved: true, comment: "go" },
    });
    expect(view.pendingApprovals).toEqual([]);
    expect(view.runStatus).toBe("idle");
  });

  it("settles a declined call on the refusal the model read", () => {
    const { tool } = toolOf([
      toolStart,
      request,
      awaiting,
      { type: "run:start", sessionId: "s" },
      {
        type: "approval:resolved",
        toolCallId: "call-1",
        approved: false,
        comment: "not yet",
      },
      toolEnd(true),
      { type: "run:end", reason: "done" },
    ]);
    expect(tool).toMatchObject({
      status: "error",
      approval: { approved: false, comment: "not yet" },
    });
  });

  it("retracts a request still open when the turn ends any other way", () => {
    const { view, tool } = toolOf([
      toolStart,
      request,
      { type: "error", kind: AgentErrorKind.Internal },
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
