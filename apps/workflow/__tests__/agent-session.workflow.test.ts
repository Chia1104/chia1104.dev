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

vi.mock("@chia/workflow-control/agent-hooks", async () => {
  const z = await import("zod");
  return {
    AGENT_END_SENTINEL: "/end",
    agentAbortControllerRefSchema: z.object({
      id: z.string(),
      runId: z.string(),
    }),
    agentAttachmentPayloadSchema: z.object({
      type: z.string(),
      id: z.number().int(),
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
        runId: "run-1",
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
      runId: "run-1",
      userId: "user-1",
      abortController: { id: "abort-1", runId: "abort-run-1" },
      text: "first",
      template: undefined,
      attachments: undefined,
      credentials: { anthropic: "initial" },
    });
    expect(mocks.runTurn).toHaveBeenNthCalledWith(2, {
      sessionId: "session-1",
      runId: "run-1",
      userId: "user-1",
      abortController: { id: "abort-1", runId: "abort-run-1" },
      text: "/translate zh-TW",
      template: { name: "translate", args: ["zh-TW"] },
      attachments: undefined,
      credentials: { openai: "rotated" },
    });
    expect(mocks.completeRun).toHaveBeenCalledWith(
      "run-1",
      { id: "abort-1", runId: "abort-run-1" },
      "completed"
    );
    expect(mocks.closeStreams).toHaveBeenCalledOnce();
  });

  it("parks on the gated call's approval hook and relays the decision as one more turn", async () => {
    mocks.createMessageHook.mockReturnValue(messageHook([{ text: "/end" }]));
    mocks.runTurn
      .mockResolvedValueOnce({
        status: "awaiting_approval",
        approval: {
          toolCallId: "call-1",
          toolName: "commit_draft",
          approvalKey: "commit_draft:7@3",
        },
        error: undefined,
      })
      .mockResolvedValueOnce({ status: "done", error: undefined });
    mocks.createApprovalHook.mockReturnValue(
      Promise.resolve({
        approved: true,
        comment: "go",
        credentials: { openai: "fresh" },
      })
    );

    await expect(
      agentSessionWorkflow({
        sessionId: "session-1",
        runId: "run-1",
        userId: "user-1",
        abortController: { id: "abort-1", runId: "abort-run-1" },
        firstMessage: { text: "commit it" },
      })
    ).resolves.toEqual({ sessionId: "session-1", turns: 2 });

    expect(mocks.createApprovalHook).toHaveBeenCalledExactlyOnceWith({
      token: "agent:approve:session-1:call-1",
    });
    // No pre-authorisation crosses the step boundary: the persisted decision seeds the gate.
    expect(mocks.runTurn).toHaveBeenNthCalledWith(2, {
      sessionId: "session-1",
      runId: "run-1",
      userId: "user-1",
      abortController: { id: "abort-1", runId: "abort-run-1" },
      text: expect.stringContaining("commit_draft"),
      decision: {
        toolCallId: "call-1",
        toolName: "commit_draft",
        approved: true,
        comment: "go",
      },
      credentials: { openai: "fresh" },
    });
  });

  it("keeps relaying while each relay turn gates another call", async () => {
    mocks.createMessageHook.mockReturnValue(messageHook([{ text: "/end" }]));
    const gated = (toolCallId: string) => ({
      status: "awaiting_approval" as const,
      approval: {
        toolCallId,
        toolName: "set_published",
        approvalKey: `set_published:${toolCallId}`,
      },
      error: undefined,
    });
    mocks.runTurn
      .mockResolvedValueOnce(gated("call-1"))
      .mockResolvedValueOnce(gated("call-2"))
      .mockResolvedValueOnce({ status: "done", error: undefined });
    mocks.createApprovalHook.mockImplementation(
      ({ token }: { token: string }) =>
        Promise.resolve({
          approved: token.endsWith("call-1"),
          comment: undefined,
        })
    );

    await expect(
      agentSessionWorkflow({
        sessionId: "session-1",
        runId: "run-1",
        userId: "user-1",
        abortController: { id: "abort-1", runId: "abort-run-1" },
        firstMessage: { text: "publish both" },
      })
    ).resolves.toEqual({ sessionId: "session-1", turns: 3 });

    expect(
      mocks.createApprovalHook.mock.calls.map(([arg]) => arg.token)
    ).toEqual([
      "agent:approve:session-1:call-1",
      "agent:approve:session-1:call-2",
    ]);
    expect(mocks.runTurn.mock.calls[2]?.[0]).toMatchObject({
      decision: { toolCallId: "call-2", approved: false },
    });
  });

  it("stops taking prompts at the turn cap but lets an approval handshake in progress finish", async () => {
    // Prompts beyond what the cap consumes must remain unread: the run ends instead.
    const queue = [{ text: "one more" }, { text: "/end" }];
    mocks.createMessageHook.mockReturnValue(messageHook(queue));
    let calls = 0;
    mocks.runTurn.mockImplementation(async () => {
      calls += 1;
      // The 200th turn gates a call; its relay is turn 201.
      if (calls === 200) {
        return {
          status: "awaiting_approval",
          approval: {
            toolCallId: "call-200",
            toolName: "commit_draft",
            approvalKey: "commit_draft:7@1",
          },
          error: undefined,
        };
      }
      return { status: "done", error: undefined };
    });
    mocks.createApprovalHook.mockReturnValue(
      Promise.resolve({ approved: true, comment: undefined })
    );
    // 199 queued prompts fill the run up to the gated turn.
    for (let index = 0; index < 199; index += 1) {
      queue.unshift({ text: `prompt ${index}` });
    }

    await expect(
      agentSessionWorkflow({
        sessionId: "session-1",
        runId: "run-1",
        userId: "user-1",
        abortController: { id: "abort-1", runId: "abort-run-1" },
        firstMessage: { text: "first" },
      })
    ).resolves.toEqual({ sessionId: "session-1", turns: 201 });

    expect(mocks.runTurn.mock.calls[200]?.[0]).toMatchObject({
      decision: { toolCallId: "call-200", approved: true },
    });
    expect(queue.map((message) => message.text)).toEqual(["one more", "/end"]);
    expect(mocks.completeRun).toHaveBeenCalledWith(
      "run-1",
      { id: "abort-1", runId: "abort-run-1" },
      "completed"
    );
  });

  it("marks the run failed and closes its streams when a turn step throws", async () => {
    mocks.createMessageHook.mockReturnValue(messageHook([]));
    mocks.runTurn.mockRejectedValue(new Error("process died mid-step"));

    await expect(
      agentSessionWorkflow({
        sessionId: "session-1",
        runId: "run-1",
        userId: "user-1",
        abortController: { id: "abort-1", runId: "abort-run-1" },
        firstMessage: { text: "first" },
      })
    ).rejects.toThrow("process died mid-step");

    expect(mocks.completeRun).toHaveBeenCalledExactlyOnceWith(
      "run-1",
      { id: "abort-1", runId: "abort-run-1" },
      "failed"
    );
    expect(mocks.closeStreams).toHaveBeenCalledOnce();
  });

  it("refuses to execute when another workflow already owns the session inbox", async () => {
    mocks.getConflict.mockResolvedValue({ runId: "existing-run" });
    mocks.createMessageHook.mockReturnValue(messageHook([]));

    await expect(
      agentSessionWorkflow({
        sessionId: "session-1",
        runId: "run-1",
        userId: "user-1",
        abortController: { id: "abort-1", runId: "abort-run-1" },
        firstMessage: { text: "first" },
      })
    ).rejects.toThrow(
      "Agent session session-1 is already driven by workflow run existing-run."
    );
    expect(mocks.runTurn).not.toHaveBeenCalled();
    // Its own row was written ahead of it by `prompt`; it must not stay active.
    expect(mocks.completeRun).toHaveBeenCalledWith(
      "run-1",
      { id: "abort-1", runId: "abort-run-1" },
      "failed"
    );
  });
});
