import { describe, expect, it, vi } from "vitest";

import type { AgentWireEvent } from "@chia/agent-core";

import type { AgentEngineHandle } from "../src/engine.ts";
import { createAgentRuntime } from "../src/runtime.ts";

const createHandle = (
  overrides: Partial<AgentEngineHandle> = {}
): AgentEngineHandle => ({
  approvalRequests: [],
  prompt: vi.fn(async () => undefined),
  promptFromTemplate: vi.fn(async () => undefined),
  drainPendingMessages: vi.fn(async () => 0),
  dispose: vi.fn(),
  ...overrides,
});

describe("createAgentRuntime", () => {
  it("runs a prompt, persists approvals, and owns the turn event lifecycle", async () => {
    const events: AgentWireEvent[] = [];
    const handle = createHandle({
      approvalRequests: [
        {
          toolCallId: "call-1",
          toolName: "publish",
          tier: "commit",
          args: { slug: "hello" },
        },
      ],
    });
    const persisted: string[] = [];
    const flushEvents = vi.fn(async () => undefined);
    const runtime = createAgentRuntime({
      kind: "test",
      createEngine: vi.fn(async () => handle),
    });

    const result = await runtime.runTurn({
      createOptions: {
        agentSessionId: "session-1",
        onEvent: (event) => events.push(event),
      },
      message: { text: "Publish it" },
      toApproval: (approval) => approval.toolCallId,
      persistApproval: async (approval) => {
        persisted.push(approval);
      },
      flushEvents,
    });

    expect(handle.prompt).toHaveBeenCalledWith("Publish it");
    expect(handle.promptFromTemplate).not.toHaveBeenCalled();
    expect(persisted).toEqual(["call-1"]);
    expect(result).toEqual({
      status: "awaiting_approval",
      approvals: ["call-1"],
      error: undefined,
    });
    expect(events.map((event) => event.type)).toEqual([
      "run:start",
      "user",
      "run:end",
    ]);
    expect(events.at(-1)).toEqual({
      type: "run:end",
      reason: "awaiting_approval",
    });
    expect(handle.dispose).toHaveBeenCalledOnce();
    expect(flushEvents).toHaveBeenCalledOnce();
  });

  it("dispatches templates and turns engine failures into terminal wire events", async () => {
    const events: AgentWireEvent[] = [];
    const handle = createHandle({
      promptFromTemplate: vi.fn(async () => {
        throw new Error("provider failed");
      }),
    });
    const runtime = createAgentRuntime({
      kind: "test",
      createEngine: async () => handle,
    });

    const result = await runtime.runTurn({
      createOptions: {
        agentSessionId: "session-1",
        onEvent: (event) => events.push(event),
      },
      message: {
        text: "Ignored when a template is selected",
        template: { name: "draft", args: ["zh-TW"] },
      },
      toApproval: (approval) => approval.toolCallId,
      persistApproval: async () => undefined,
    });

    expect(handle.promptFromTemplate).toHaveBeenCalledWith("draft", ["zh-TW"]);
    expect(result).toEqual({
      status: "error",
      approvals: [],
      error: "provider failed",
    });
    expect(events.slice(-2)).toEqual([
      { type: "error", message: "provider failed" },
      { type: "run:end", reason: "error" },
    ]);
    expect(handle.dispose).toHaveBeenCalledOnce();
  });

  it("serializes pending-message drains and waits for them before disposal", async () => {
    vi.useFakeTimers();

    try {
      const prompt = Promise.withResolvers<void>();
      const pendingDrain = Promise.withResolvers<number>();
      const handle = createHandle({
        prompt: vi.fn(() => prompt.promise),
        drainPendingMessages: vi.fn(() => pendingDrain.promise),
      });
      const runtime = createAgentRuntime({
        kind: "test",
        createEngine: async () => handle,
      });

      const turn = runtime.runTurn({
        createOptions: {
          agentSessionId: "session-1",
          onEvent: () => undefined,
        },
        message: { text: "Hello" },
        toApproval: (approval) => approval.toolCallId,
        persistApproval: async () => undefined,
        drainIntervalMs: 100,
      });

      await vi.advanceTimersByTimeAsync(100);
      expect(handle.drainPendingMessages).toHaveBeenCalledOnce();

      await vi.advanceTimersByTimeAsync(300);
      expect(handle.drainPendingMessages).toHaveBeenCalledOnce();

      prompt.resolve();
      await vi.advanceTimersByTimeAsync(0);
      expect(handle.dispose).not.toHaveBeenCalled();

      pendingDrain.resolve(1);
      await turn;
      expect(handle.dispose).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("allows a later drain to retry after a failed attempt", async () => {
    vi.useFakeTimers();

    try {
      const prompt = Promise.withResolvers<void>();
      const handle = createHandle({
        prompt: vi.fn(() => prompt.promise),
        drainPendingMessages: vi
          .fn()
          .mockRejectedValueOnce(new Error("temporary failure"))
          .mockResolvedValue(0),
      });
      const runtime = createAgentRuntime({
        kind: "test",
        createEngine: async () => handle,
      });

      const turn = runtime.runTurn({
        createOptions: {
          agentSessionId: "session-1",
          onEvent: () => undefined,
        },
        message: { text: "Hello" },
        toApproval: (approval) => approval.toolCallId,
        persistApproval: async () => undefined,
        drainIntervalMs: 100,
      });

      await vi.advanceTimersByTimeAsync(100);
      expect(handle.drainPendingMessages).toHaveBeenCalledOnce();

      await vi.advanceTimersByTimeAsync(100);
      expect(handle.drainPendingMessages).toHaveBeenCalledTimes(2);

      prompt.resolve();
      await turn;
    } finally {
      vi.useRealTimers();
    }
  });

  it("compacts at the end of a clean turn", async () => {
    const handle = createHandle({
      compactIfNeeded: vi.fn(async () => ({
        summary: "…",
        tokensBefore: 120_000,
      })),
    });
    const runtime = createAgentRuntime({
      kind: "test",
      createEngine: async () => handle,
    });

    const result = await runtime.runTurn({
      createOptions: {
        agentSessionId: "session-1",
        onEvent: () => undefined,
      },
      message: { text: "Hello" },
      toApproval: (approval) => approval.toolCallId,
      persistApproval: async () => undefined,
    });

    expect(result.status).toBe("done");
    expect(handle.compactIfNeeded).toHaveBeenCalledOnce();
  });

  it("leaves the session tree alone while a turn is parked on an approval", async () => {
    const handle = createHandle({
      approvalRequests: [
        {
          toolCallId: "call-1",
          toolName: "publish",
          tier: "commit",
          args: {},
        },
      ],
      compactIfNeeded: vi.fn(async () => null),
    });
    const runtime = createAgentRuntime({
      kind: "test",
      createEngine: async () => handle,
    });

    const result = await runtime.runTurn({
      createOptions: {
        agentSessionId: "session-1",
        onEvent: () => undefined,
      },
      message: { text: "Publish it" },
      toApproval: (approval) => approval.toolCallId,
      persistApproval: async () => undefined,
    });

    // Compacting here would move the horizon out from under the run that resumes on approval.
    expect(result.status).toBe("awaiting_approval");
    expect(handle.compactIfNeeded).not.toHaveBeenCalled();
  });

  it("keeps the history of a failed turn so it stays diagnosable", async () => {
    const handle = createHandle({
      prompt: vi.fn(async () => {
        throw new Error("provider failed");
      }),
      compactIfNeeded: vi.fn(async () => null),
    });
    const runtime = createAgentRuntime({
      kind: "test",
      createEngine: async () => handle,
    });

    const result = await runtime.runTurn({
      createOptions: {
        agentSessionId: "session-1",
        onEvent: () => undefined,
      },
      message: { text: "Hello" },
      toApproval: (approval) => approval.toolCallId,
      persistApproval: async () => undefined,
    });

    expect(result.status).toBe("error");
    expect(handle.compactIfNeeded).not.toHaveBeenCalled();
  });

  it("completes the turn when compaction fails", async () => {
    const events: AgentWireEvent[] = [];
    const handle = createHandle({
      compactIfNeeded: vi.fn(async () => {
        throw new Error("summarisation model unavailable");
      }),
    });
    const runtime = createAgentRuntime({
      kind: "test",
      createEngine: async () => handle,
    });

    const result = await runtime.runTurn({
      createOptions: {
        agentSessionId: "session-1",
        onEvent: (event) => events.push(event),
      },
      message: { text: "Hello" },
      toApproval: (approval) => approval.toolCallId,
      persistApproval: async () => undefined,
    });

    // The next turn boundary retries; a compaction failure is not the turn's failure.
    expect(result).toEqual({ status: "done", approvals: [], error: undefined });
    expect(events.at(-1)).toEqual({ type: "run:end", reason: "done" });
    expect(events.some((event) => event.type === "error")).toBe(false);
  });

  it("runs a turn on an engine that cannot compact at all", async () => {
    const handle = createHandle();
    const runtime = createAgentRuntime({
      kind: "test",
      createEngine: async () => handle,
    });

    const result = await runtime.runTurn({
      createOptions: {
        agentSessionId: "session-1",
        onEvent: () => undefined,
      },
      message: { text: "Hello" },
      toApproval: (approval) => approval.toolCallId,
      persistApproval: async () => undefined,
    });

    expect(handle.compactIfNeeded).toBeUndefined();
    expect(result.status).toBe("done");
  });

  it("flushes the event sink when engine construction fails", async () => {
    const flushEvents = vi.fn(async () => undefined);
    const runtime = createAgentRuntime({
      kind: "test",
      createEngine: async () => {
        throw new Error("engine unavailable");
      },
    });

    await expect(
      runtime.runTurn({
        createOptions: {
          agentSessionId: "session-1",
          onEvent: () => undefined,
        },
        message: { text: "Hello" },
        toApproval: (approval) => approval.toolCallId,
        persistApproval: async () => undefined,
        flushEvents,
      })
    ).rejects.toThrow("engine unavailable");
    expect(flushEvents).toHaveBeenCalledOnce();
  });
});
