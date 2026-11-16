import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  closeStreams: vi.fn(),
  completeRun: vi.fn(),
  createAbortHook: vi.fn(),
  runTurn: vi.fn(),
}));

vi.mock("@chia/workflow-control/agent-hooks", () => ({
  agentAbortHook: { create: mocks.createAbortHook },
  agentAbortToken: (runId: string) => `agent:abort:${runId}`,
}));

vi.mock("../src/steps/agent-turn.step", () => ({
  closeAgentStreamsStep: mocks.closeStreams,
  completeAgentRunStep: mocks.completeRun,
  runAgentTurnStep: mocks.runTurn,
}));

import { ApprovalVerdict } from "@chia/agent-runtime/types";
import { AgentRunStatus } from "@chia/db/schema";

import type { AgentTurnRequest } from "../src/steps/agent-turn.step";
import { agentSessionWorkflow } from "../src/workflows/agent-session.workflow";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.closeStreams.mockResolvedValue(undefined);
  mocks.completeRun.mockResolvedValue(undefined);
  // Never resumed unless a test says so.
  mocks.createAbortHook.mockReturnValue(new Promise(() => undefined));
  mocks.runTurn.mockResolvedValue({ status: "done", error: undefined });
});

describe("agentSessionWorkflow", () => {
  it("runs exactly one turn, then closes the run row and its streams", async () => {
    await expect(
      agentSessionWorkflow({
        sessionId: "session-1",
        runId: "run-1",
        userId: "user-1",
        message: {
          type: "prompt",
          text: "/translate zh-TW",
          template: { name: "translate", args: ["zh-TW"] },
          attachments: [{ type: "draft", id: 7 }],
          credentials: { anthropic: "initial" },
        },
      })
    ).resolves.toEqual({ sessionId: "session-1", status: "done" });

    expect(mocks.runTurn).toHaveBeenCalledExactlyOnceWith(
      {
        sessionId: "session-1",
        runId: "run-1",
        userId: "user-1",
        message: {
          type: "prompt",
          text: "/translate zh-TW",
          template: { name: "translate", args: ["zh-TW"] },
          attachments: [{ type: "draft", id: 7 }],
          credentials: { anthropic: "initial" },
        },
      },
      expect.any(AbortSignal)
    );
    expect(mocks.createAbortHook).toHaveBeenCalledExactlyOnceWith({
      token: "agent:abort:run-1",
    });
    expect(mocks.completeRun).toHaveBeenCalledExactlyOnceWith(
      "run-1",
      AgentRunStatus.Completed
    );
    expect(mocks.closeStreams).toHaveBeenCalledOnce();
  });

  it("ends the run when the turn stops on gated calls; the answers resume it as a run of their own", async () => {
    mocks.runTurn.mockResolvedValue({ status: "awaiting_approval" });

    await expect(
      agentSessionWorkflow({
        sessionId: "session-1",
        runId: "run-1",
        userId: "user-1",
        message: { type: "prompt", text: "commit it" },
      })
    ).resolves.toEqual({ sessionId: "session-1", status: "awaiting_approval" });
    expect(mocks.completeRun).toHaveBeenCalledWith(
      "run-1",
      AgentRunStatus.Completed
    );

    // The resume is a fresh run carrying the recorded answers; nothing is parked between.
    const resume = {
      interruptedRunId: "run-1",
      decisions: [
        {
          toolCallId: "call-1",
          verdict: ApprovalVerdict.Approved,
          comment: "go",
        },
      ],
    };
    await agentSessionWorkflow({
      sessionId: "session-1",
      runId: "run-2",
      userId: "user-1",
      message: { type: "resume", resume, credentials: { openai: "fresh" } },
    });

    expect(mocks.runTurn).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runId: "run-2",
        message: { type: "resume", resume, credentials: { openai: "fresh" } },
      }),
      expect.any(AbortSignal)
    );
  });

  it("aborts the executing turn when its hook is resumed, then records what the turn returned", async () => {
    let resume: (payload: { reason: string }) => void = () => undefined;
    mocks.createAbortHook.mockReturnValue(
      new Promise<{ reason: string }>((resolve) => {
        resume = resolve;
      })
    );
    mocks.runTurn.mockImplementation(
      (_request: AgentTurnRequest, signal: AbortSignal) =>
        new Promise((resolve) => {
          signal.addEventListener("abort", () =>
            resolve({ status: "aborted" })
          );
        })
    );

    const run = agentSessionWorkflow({
      sessionId: "session-1",
      runId: "run-1",
      userId: "user-1",
      message: { type: "prompt", text: "first" },
    });
    resume({ reason: "stopped by the operator" });

    await expect(run).resolves.toEqual({
      sessionId: "session-1",
      status: "aborted",
    });
    expect(mocks.completeRun).toHaveBeenCalledExactlyOnceWith(
      "run-1",
      AgentRunStatus.Cancelled
    );
  });

  it("records the turn's outcome on the run row: failed for an error, cancelled for an abort", async () => {
    for (const [outcome, status] of [
      ["error", AgentRunStatus.Failed],
      ["aborted", AgentRunStatus.Cancelled],
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
        message: { type: "prompt", text: "first" },
      });

      expect(mocks.completeRun).toHaveBeenCalledExactlyOnceWith(
        "run-1",
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
        message: { type: "prompt", text: "first" },
      })
    ).rejects.toThrow("process died mid-step");

    expect(mocks.completeRun).toHaveBeenCalledExactlyOnceWith(
      "run-1",
      AgentRunStatus.Failed
    );
    expect(mocks.closeStreams).toHaveBeenCalledOnce();
  });
});
