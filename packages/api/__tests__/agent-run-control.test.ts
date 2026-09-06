import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentWireEvent } from "@chia/agent-runtime/wire/schema";
import {
  createFakeRuns,
  getRun,
  resetWorkflowMocks,
} from "@chia/test/mocks/workflow";

const runs = createFakeRuns();

const repo = vi.hoisted(() => ({
  completeAgentRun: vi.fn(),
  listRunningAgentRuns: vi.fn(),
}));

vi.mock("@chia/db/repos/agent", () => repo);

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

  it("reports a turn as ended when its run:end arrives or the run closes its stream", async () => {
    const { waitForAgentTurnEnd } =
      await import("../orpc/services/agent/run-control");
    const ended = (events: AgentWireEvent[]) =>
      workflowReadable(
        new ReadableStream<AgentWireEvent>({
          start: (controller) => {
            for (const event of events) controller.enqueue(event);
            controller.close();
          },
        })
      );

    getRun.mockReturnValue({
      getReadable: vi.fn(() => ended([{ type: "run:end", reason: "aborted" }])),
    });
    await expect(waitForAgentTurnEnd(runs, "workflow-1", 0)).resolves.toBe(
      true
    );

    getRun.mockReturnValue({ getReadable: vi.fn(() => ended([])) });
    await expect(waitForAgentTurnEnd(runs, "workflow-1", 0)).resolves.toBe(
      true
    );
  });

  it("does not mistake its own deadline for the turn ending", async () => {
    vi.useFakeTimers();
    try {
      const { waitForAgentTurnEnd } =
        await import("../orpc/services/agent/run-control");
      // A stream that never yields: the step is still executing.
      getRun.mockReturnValue({
        getReadable: vi.fn(() =>
          workflowReadable(
            new ReadableStream<AgentWireEvent>({ start: () => undefined })
          )
        ),
      });

      const pending = waitForAgentTurnEnd(runs, "workflow-1", 0);
      await vi.advanceTimersByTimeAsync(10_000);

      await expect(pending).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }
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
