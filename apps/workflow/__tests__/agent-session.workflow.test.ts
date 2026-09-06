import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  closeStreams: vi.fn(),
  completeRun: vi.fn(),
  runTurn: vi.fn(),
}));

vi.mock("../src/steps/agent-turn.step", () => ({
  closeAgentStreamsStep: mocks.closeStreams,
  completeAgentRunStep: mocks.completeRun,
  runAgentTurnStep: mocks.runTurn,
}));

vi.mock("@chia/workflow-control/agent-hooks", async () => {
  const z = await import("zod");
  const decision = z.object({
    toolCallId: z.string(),
    toolName: z.string(),
    approved: z.boolean(),
    comment: z.string().optional(),
  });
  return {
    agentAbortControllerRefSchema: z.object({
      id: z.string(),
      runId: z.string(),
    }),
    agentMessagePayloadSchema: z.object({
      text: z.string(),
      template: z
        .object({ name: z.string(), args: z.array(z.string()).optional() })
        .optional(),
      attachments: z
        .array(z.object({ type: z.string(), id: z.number().int() }))
        .optional(),
      decision: decision.optional(),
      credentials: z
        .object({
          openai: z.string().optional(),
          anthropic: z.string().optional(),
        })
        .optional(),
    }),
  };
});

import { agentSessionWorkflow } from "../src/workflows/agent-session.workflow";

const abortController = { id: "abort-1", runId: "abort-run-1" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.closeStreams.mockResolvedValue(undefined);
  mocks.completeRun.mockResolvedValue(undefined);
  mocks.runTurn.mockResolvedValue({ status: "done", error: undefined });
});

describe("agentSessionWorkflow", () => {
  it("runs exactly one turn, then closes the run row and its streams", async () => {
    await expect(
      agentSessionWorkflow({
        sessionId: "session-1",
        runId: "run-1",
        userId: "user-1",
        abortController,
        message: {
          text: "/translate zh-TW",
          template: { name: "translate", args: ["zh-TW"] },
          attachments: [{ type: "draft", id: 7 }],
          credentials: { anthropic: "initial" },
        },
      })
    ).resolves.toEqual({ sessionId: "session-1", status: "done" });

    expect(mocks.runTurn).toHaveBeenCalledExactlyOnceWith({
      sessionId: "session-1",
      runId: "run-1",
      userId: "user-1",
      abortController,
      text: "/translate zh-TW",
      template: { name: "translate", args: ["zh-TW"] },
      attachments: [{ type: "draft", id: 7 }],
      decision: undefined,
      credentials: { anthropic: "initial" },
    });
    expect(mocks.completeRun).toHaveBeenCalledExactlyOnceWith(
      "run-1",
      abortController,
      "completed"
    );
    expect(mocks.closeStreams).toHaveBeenCalledOnce();
  });

  it("ends the run when the turn stops on a gated call; the decision arrives as its own run", async () => {
    mocks.runTurn.mockResolvedValue({
      status: "awaiting_approval",
      approval: {
        toolCallId: "call-1",
        toolName: "commit_draft",
        approvalKey: "commit_draft:7@3",
      },
      error: undefined,
    });

    await expect(
      agentSessionWorkflow({
        sessionId: "session-1",
        runId: "run-1",
        userId: "user-1",
        abortController,
        message: { text: "commit it" },
      })
    ).resolves.toEqual({ sessionId: "session-1", status: "awaiting_approval" });
    expect(mocks.completeRun).toHaveBeenCalledWith(
      "run-1",
      abortController,
      "completed"
    );

    // The relay is a fresh run carrying the recorded decision; nothing is parked between.
    await agentSessionWorkflow({
      sessionId: "session-1",
      runId: "run-2",
      userId: "user-1",
      abortController: { id: "abort-2", runId: "abort-run-2" },
      message: {
        text: "Operator decision: approved commit_draft",
        decision: {
          toolCallId: "call-1",
          toolName: "commit_draft",
          approved: true,
          comment: "go",
        },
        credentials: { openai: "fresh" },
      },
    });

    expect(mocks.runTurn).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runId: "run-2",
        decision: {
          toolCallId: "call-1",
          toolName: "commit_draft",
          approved: true,
          comment: "go",
        },
        credentials: { openai: "fresh" },
      })
    );
  });

  it("records the turn's outcome on the run row: failed for an error, cancelled for an abort", async () => {
    for (const [outcome, status] of [
      ["error", "failed"],
      ["aborted", "cancelled"],
    ] as const) {
      mocks.completeRun.mockClear();
      mocks.runTurn.mockResolvedValueOnce({
        status: outcome,
        error: undefined,
      });

      await agentSessionWorkflow({
        sessionId: "session-1",
        runId: "run-1",
        userId: "user-1",
        abortController,
        message: { text: "first" },
      });

      expect(mocks.completeRun).toHaveBeenCalledExactlyOnceWith(
        "run-1",
        abortController,
        status
      );
    }
  });

  it("marks the run failed and closes its streams when the turn step throws", async () => {
    mocks.runTurn.mockRejectedValue(new Error("process died mid-step"));

    await expect(
      agentSessionWorkflow({
        sessionId: "session-1",
        runId: "run-1",
        userId: "user-1",
        abortController,
        message: { text: "first" },
      })
    ).rejects.toThrow("process died mid-step");

    expect(mocks.completeRun).toHaveBeenCalledExactlyOnceWith(
      "run-1",
      abortController,
      "failed"
    );
    expect(mocks.closeStreams).toHaveBeenCalledOnce();
  });
});
