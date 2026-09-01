import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentWireEvent } from "@chia/agent-runtime/wire/schema";
import { createFakeRuns, getRun, resetWorkflowMocks } from "@chia/test/mocks/workflow";

const runs = createFakeRuns();

const repo = vi.hoisted(() => ({
  completeAgentRun: vi.fn(),
  getAgentSessionLastSeq: vi.fn(),
  listRunningAgentRuns: vi.fn(),
  patchAgentRunMetadata: vi.fn(),
}));

vi.mock("@chia/db/repos/agent", () => repo);

const db =
  /* SAFETY: every repository operation in this suite is mocked. */ {} as never;

const workflowReadable = <T>(stream: ReadableStream<T>, tailIndex = -1) =>
  Object.assign(stream, { getTailIndex: async () => tailIndex });

const collect = async (events: AsyncIterable<AgentWireEvent>) => {
  const result: AgentWireEvent[] = [];
  for await (const event of events) result.push(event);
  return result;
};

describe("agent run control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkflowMocks();
  });

  it("claims both durable stream tails as one cursor and marker", async () => {
    const getReadable = vi.fn((options?: { namespace?: string }) =>
      workflowReadable(
        new ReadableStream({ start: (controller) => controller.close() }),
        options?.namespace ? 6 : 3
      )
    );
    getRun.mockReturnValue({ getReadable });
    repo.getAgentSessionLastSeq.mockResolvedValue(42);
    repo.patchAgentRunMetadata.mockResolvedValue(undefined);

    const { claimNextAgentTurn } =
      await import("../orpc/services/agent/run-control");
    const cursor = await claimNextAgentTurn(
      runs,
      db,
      {
        id: "session-1",
        activeRunId: "run-1",
        turn: {
          seqBefore: 0,
          streamIndex: 0,
          deltaStreamIndex: 0,
          running: false,
        },
      },
      "workflow-1"
    );

    expect(cursor).toEqual({
      runId: "workflow-1",
      startIndex: 4,
      deltaStartIndex: 7,
    });
    expect(repo.patchAgentRunMetadata).toHaveBeenCalledExactlyOnceWith(
      db,
      "run-1",
      {
        turn: {
          seqBefore: 42,
          streamIndex: 4,
          deltaStreamIndex: 7,
          running: true,
        },
      }
    );
  });

  it("merges batched deltas with coarse events", async () => {
    let coarseController!: ReadableStreamDefaultController<AgentWireEvent>;
    let deltaController!: ReadableStreamDefaultController<AgentWireEvent[]>;
    const coarse = workflowReadable(
      new ReadableStream<AgentWireEvent>({
        start(controller) {
          coarseController = controller;
        },
      })
    );
    const deltas = workflowReadable(
      new ReadableStream<AgentWireEvent[]>({
        start(controller) {
          deltaController = controller;
        },
      })
    );
    const getReadable = vi.fn((options?: { namespace?: string }) =>
      options?.namespace ? deltas : coarse
    );
    getRun.mockReturnValue({ getReadable });

    const { streamAgentRunEvents } =
      await import("../orpc/services/agent/run-control");
    const output = collect(
      streamAgentRunEvents({
        runs,
        runId: "workflow-1",
        startIndex: 2,
        deltaStartIndex: 5,
      })
    );

    await vi.waitFor(() => expect(getReadable).toHaveBeenCalledTimes(2));
    coarseController.enqueue({ type: "run:start", sessionId: "session-1" });
    await Promise.resolve();
    deltaController.enqueue([
      {
        type: "assistant:delta",
        messageId: "message-1",
        channel: "text",
        delta: "a",
      },
      {
        type: "assistant:delta",
        messageId: "message-1",
        channel: "text",
        delta: "b",
      },
    ]);
    coarseController.close();
    deltaController.close();

    await expect(output).resolves.toEqual([
      { type: "run:start", sessionId: "session-1" },
      {
        type: "assistant:delta",
        messageId: "message-1",
        channel: "text",
        delta: "a",
      },
      {
        type: "assistant:delta",
        messageId: "message-1",
        channel: "text",
        delta: "b",
      },
    ]);
    expect(getReadable).toHaveBeenCalledWith({ startIndex: 2 });
    expect(getReadable).toHaveBeenCalledWith({
      namespace: "agent:deltas",
      startIndex: 5,
    });
  });

  it("cancels the durable reader when its consumer disconnects", async () => {
    const cancelled = vi.fn();
    const readable = workflowReadable(
      new ReadableStream<AgentWireEvent>({
        start(controller) {
          controller.enqueue({
            type: "run:start",
            sessionId: "session-1",
          });
        },
        cancel: cancelled,
      })
    );
    getRun.mockReturnValue({
      getReadable: vi.fn(() => readable),
    });

    const { streamAgentRunEvents } =
      await import("../orpc/services/agent/run-control");
    const iterator = streamAgentRunEvents({ runs, runId: "workflow-1" });

    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: { type: "run:start", sessionId: "session-1" },
    });
    await iterator.return();

    expect(cancelled).toHaveBeenCalledOnce();
  });
});
