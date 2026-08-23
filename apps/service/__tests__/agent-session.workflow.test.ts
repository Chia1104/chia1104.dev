import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  closeStreams: vi.fn(),
  completeRun: vi.fn(),
  createApprovalHook: vi.fn(),
  createMessageHook: vi.fn(),
  getConflict: vi.fn(),
  runTurn: vi.fn(),
}));

vi.mock("../src/steps/agent-turn.step", () => ({
  closeAgentStreamsStep: mocks.closeStreams,
  completeAgentRunStep: mocks.completeRun,
  runAgentTurnStep: mocks.runTurn,
}));

vi.mock("../src/workflows/hooks/agent.hooks", async () => {
  const z = await import("zod");
  return {
    AGENT_END_SENTINEL: "/end",
    agentAbortControllerRefSchema: z.object({
      id: z.string(),
      runId: z.string(),
    }),
    agentApprovalHook: { create: mocks.createApprovalHook },
    agentApprovalToken: (sessionId: string, toolCallId: string) =>
      `agent:approve:${sessionId}:${toolCallId}`,
    agentMessageHook: { create: mocks.createMessageHook },
    agentMessageToken: (sessionId: string) => `agent:msg:${sessionId}`,
    encryptedAgentCredentialsSchema: z.object({
      openai: z.string().optional(),
      anthropic: z.string().optional(),
    }),
  };
});

import { agentSessionWorkflow } from "../src/workflows/agent-session.workflow";

interface Message {
  text: string;
  template?: { name: string; args?: string[] };
  credentials?: { openai?: string; anthropic?: string };
}

const messageHook = (queue: Message[]) => ({
  getConflict: mocks.getConflict,
  then<TResult1 = Message>(
    onFulfilled?: ((value: Message) => TResult1 | PromiseLike<TResult1>) | null
  ): PromiseLike<TResult1> {
    const next = queue.shift();
    if (!next) return Promise.reject(new Error("Message hook queue exhausted"));
    return Promise.resolve(next).then(onFulfilled);
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.closeStreams.mockResolvedValue(undefined);
  mocks.completeRun.mockResolvedValue(undefined);
  mocks.getConflict.mockResolvedValue(null);
  mocks.runTurn.mockResolvedValue({
    status: "done",
    approvals: [],
    error: undefined,
  });
});

describe("agentSessionWorkflow", () => {
  it("registers its durable inbox before the first turn and drains queued turns in order", async () => {
    mocks.createMessageHook.mockReturnValue(
      messageHook([
        {
          text: "/translate zh-TW",
          template: { name: "translate", args: ["zh-TW"] },
          credentials: { openai: "rotated" },
        },
        { text: "/end" },
      ])
    );

    await expect(
      agentSessionWorkflow({
        sessionId: "session-1",
        userId: "user-1",
        abortController: { id: "abort-1", runId: "abort-run-1" },
        firstMessage: {
          text: "first",
          credentials: { anthropic: "initial" },
        },
      })
    ).resolves.toEqual({ sessionId: "session-1", turns: 2 });

    expect(mocks.createMessageHook).toHaveBeenCalledWith({
      token: "agent:msg:session-1",
    });
    expect(mocks.getConflict.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.runTurn.mock.invocationCallOrder[0]!
    );
    expect(mocks.runTurn).toHaveBeenNthCalledWith(1, {
      sessionId: "session-1",
      userId: "user-1",
      abortController: { id: "abort-1", runId: "abort-run-1" },
      text: "first",
      template: undefined,
      preAuthorizeToolNames: undefined,
      credentials: { anthropic: "initial" },
    });
    expect(mocks.runTurn).toHaveBeenNthCalledWith(2, {
      sessionId: "session-1",
      userId: "user-1",
      abortController: { id: "abort-1", runId: "abort-run-1" },
      text: "/translate zh-TW",
      template: { name: "translate", args: ["zh-TW"] },
      preAuthorizeToolNames: undefined,
      credentials: { openai: "rotated" },
    });
    expect(mocks.completeRun).toHaveBeenCalledWith("session-1", {
      id: "abort-1",
      runId: "abort-run-1",
    });
    expect(mocks.closeStreams).toHaveBeenCalledOnce();
  });

  it("refuses to execute when another workflow already owns the session inbox", async () => {
    mocks.getConflict.mockResolvedValue({ runId: "existing-run" });
    mocks.createMessageHook.mockReturnValue(messageHook([]));

    await expect(
      agentSessionWorkflow({
        sessionId: "session-1",
        userId: "user-1",
        abortController: { id: "abort-1", runId: "abort-run-1" },
        firstMessage: { text: "first" },
      })
    ).rejects.toThrow(
      "Agent session session-1 is already driven by workflow run existing-run."
    );
    expect(mocks.runTurn).not.toHaveBeenCalled();
  });
});
