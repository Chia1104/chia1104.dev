import { describe, expect, it, vi } from "vitest";

import { createToolCallApprovals } from "../src/turn/approvals.ts";
import type { ToolCallBatch } from "../src/turn/approvals.ts";
import { ApprovalVerdict } from "../src/types.ts";
import type { ToolCallRequest } from "../src/types.ts";

const call = (toolName: string, id: string): ToolCallRequest => ({
  toolCallId: id,
  toolName,
  input: {},
});

const batchOf = (
  calls: ToolCallRequest[],
  replayed = false
): ToolCallBatch => ({ calls, replayed });

const policy = {
  toolInfo: (toolName: string) => ({
    label: toolName,
    tier: toolName === "commit" ? "commit" : "read",
  }),
  requiresApproval: (tier: string) => tier === "commit",
};

describe("createToolCallApprovals", () => {
  it("fails every call of a batch whose triage threw, so none of its gated calls runs", async () => {
    const approvalKeyOf = vi.fn((request: ToolCallRequest) => {
      if (request.toolCallId === "call-1") throw new Error("draft store down");
      return request.toolName;
    });
    const approvals = createToolCallApprovals({
      policy,
      autoApprove: [],
      approvalKeyOf,
      check: async () => undefined,
    });
    const first = call("commit", "call-1");
    const second = call("commit", "call-2");
    const batch = batchOf([first, second]);

    await expect(approvals.answer(first, batch)).rejects.toThrow(
      "draft store down"
    );
    await expect(approvals.answer(second, batch)).rejects.toThrow(
      "draft store down"
    );
    expect(approvalKeyOf).toHaveBeenCalledOnce();
    expect(approvals.interrupted).toBeUndefined();
  });

  it("triages a batch once when its calls are answered concurrently", async () => {
    const approvalKeyOf = vi.fn(async (request: ToolCallRequest) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return request.toolName;
    });
    const approvals = createToolCallApprovals({
      policy,
      autoApprove: [],
      approvalKeyOf,
      check: async () => undefined,
    });
    const calls = [call("commit", "call-1"), call("read", "call-2")];
    const batch = batchOf(calls);

    const answers = await Promise.all(
      calls.map((request) => approvals.answer(request, batch))
    );

    expect(answers).toEqual([{ type: "hold" }, { type: "hold" }]);
    expect(approvalKeyOf).toHaveBeenCalledOnce();
  });

  it("grants the operator's answers to the replayed batch only, whatever ids a later reply reuses", async () => {
    const approvals = createToolCallApprovals({
      policy,
      autoApprove: [],
      approvalKeyOf: (request) => request.toolName,
      check: async () => undefined,
      decisions: [
        { toolCallId: "call-1", verdict: ApprovalVerdict.Approved },
        {
          toolCallId: "call-2",
          verdict: ApprovalVerdict.Declined,
          comment: "not this one",
        },
      ],
    });
    const approved = call("commit", "call-1");
    const declined = call("commit", "call-2");

    const replayed = batchOf([approved, declined], true);
    await expect(approvals.answer(approved, replayed)).resolves.toEqual({
      type: "run",
    });
    await expect(approvals.answer(declined, replayed)).resolves.toMatchObject({
      type: "refuse",
      declined: { comment: "not this one" },
    });

    // The model's next reply reuses both ids: neither answer carries over.
    const later = batchOf([approved, declined]);
    await expect(approvals.answer(approved, later)).resolves.toEqual({
      type: "hold",
    });
    expect(approvals.interrupted?.requests).toMatchObject([
      { toolCallId: "call-1" },
      { toolCallId: "call-2" },
    ]);
  });
});
