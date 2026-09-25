import { describe, expect, it, vi } from "vitest";

import { createToolCallApprovals } from "../src/turn/approvals.ts";
import type { ToolCallRequest } from "../src/types.ts";

const call = (toolName: string, id: string): ToolCallRequest => ({
  toolCallId: id,
  toolName,
  input: {},
});

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
    const batch = [first, second];

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
    const batch = [call("commit", "call-1"), call("read", "call-2")];

    const answers = await Promise.all(
      batch.map((request) => approvals.answer(request, batch))
    );

    expect(answers).toEqual([{ type: "hold" }, { type: "hold" }]);
    expect(approvalKeyOf).toHaveBeenCalledOnce();
  });
});
