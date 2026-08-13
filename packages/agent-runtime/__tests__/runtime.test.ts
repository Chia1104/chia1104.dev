import type * as PiAgentCore from "@earendil-works/pi-agent-core";
import { createModels } from "@earendil-works/pi-ai";
import { fauxProvider } from "@earendil-works/pi-ai/providers/faux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentPolicy, AgentWireEvent } from "../src/index.ts";

const pi = vi.hoisted(() => {
  const handlers = new Map<string, (event: unknown) => unknown>();
  const unsubscribers: ReturnType<typeof vi.fn>[] = [];
  const harness = {
    prompt: vi.fn(),
    promptFromTemplate: vi.fn(),
    compact: vi.fn(),
    on: vi.fn(),
    subscribe: vi.fn(),
  };
  const AgentHarness = vi.fn(function MockAgentHarness() {
    return harness;
  });
  return { AgentHarness, handlers, harness, unsubscribers };
});

vi.mock("@earendil-works/pi-agent-core", async (importOriginal) => {
  const actual = await importOriginal<typeof PiAgentCore>();
  return { ...actual, AgentHarness: pi.AgentHarness };
});

import { runPiTurn } from "../src/pi/turn.ts";

const policy: AgentPolicy = {
  tierOf: (toolName) => (toolName === "publish" ? "commit" : "read"),
  labelOf: (toolName) => toolName,
  requiresApproval: (tier) => tier === "commit",
  summarize: () => "",
};

const createOptions = () => {
  const faux = fauxProvider({
    provider: "faux",
    models: [{ id: "test-model", contextWindow: 100_000 }],
  });
  const models = createModels();
  models.setProvider(faux.provider);
  const events: AgentWireEvent[] = [];
  const session = {
    getBranch: vi.fn(async () => []),
  } as unknown as PiAgentCore.Session;

  return {
    agentSessionId: "session-1",
    session,
    settings: {
      providerId: "faux",
      modelId: "test-model",
      thinkingLevel: "off" as const,
      activeToolNames: null,
      autoApprove: [],
    },
    model: faux.getModel(),
    models,
    tools: [],
    toolContext: {},
    systemPrompt: "",
    policy,
    message: { text: "Hello" },
    onEvent: (event: AgentWireEvent) => events.push(event),
    toApproval: (approval: { toolCallId: string }) => approval.toolCallId,
    persistApproval: vi.fn(async () => undefined),
    events,
  };
};

beforeEach(() => {
  pi.handlers.clear();
  pi.unsubscribers.splice(0);
  pi.AgentHarness.mockReset();
  pi.AgentHarness.mockImplementation(function MockAgentHarness() {
    return pi.harness;
  });
  pi.harness.prompt.mockReset().mockResolvedValue(undefined);
  pi.harness.promptFromTemplate.mockReset().mockResolvedValue(undefined);
  pi.harness.compact.mockReset().mockResolvedValue({
    summary: "summary",
    tokensBefore: 90_000,
  });
  pi.harness.on.mockReset().mockImplementation((type, handler) => {
    pi.handlers.set(type, handler);
    const unsubscribe = vi.fn();
    pi.unsubscribers.push(unsubscribe);
    return unsubscribe;
  });
  pi.harness.subscribe.mockReset().mockImplementation(() => {
    const unsubscribe = vi.fn();
    pi.unsubscribers.push(unsubscribe);
    return unsubscribe;
  });
});

describe("runPiTurn", () => {
  it("runs a prompt and owns the wire event lifecycle", async () => {
    const options = createOptions();
    const flushEvents = vi.fn(async () => undefined);

    const result = await runPiTurn({ ...options, flushEvents });

    expect(pi.harness.prompt).toHaveBeenCalledWith("Hello");
    expect(pi.harness.promptFromTemplate).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "done", approvals: [], error: undefined });
    expect(options.events.map((event) => event.type)).toEqual([
      "run:start",
      "user",
      "run:end",
    ]);
    expect(
      pi.unsubscribers.every(
        (unsubscribe) => unsubscribe.mock.calls.length === 1
      )
    ).toBe(true);
    expect(flushEvents).toHaveBeenCalledOnce();
  });

  it("persists approval requests raised by Pi's tool hook", async () => {
    const options = createOptions();
    pi.harness.prompt.mockImplementation(async () => {
      const handler = pi.handlers.get("tool_call");
      await handler?.({
        type: "tool_call",
        toolCallId: "call-1",
        toolName: "publish",
        input: { slug: "hello" },
      });
    });

    const result = await runPiTurn(options);

    expect(options.persistApproval).toHaveBeenCalledWith("call-1");
    expect(result).toEqual({
      status: "awaiting_approval",
      approvals: ["call-1"],
      error: undefined,
    });
    expect(options.events).toContainEqual({
      type: "approval:request",
      toolCallId: "call-1",
      toolName: "publish",
      tier: "commit",
      args: { slug: "hello" },
    });
  });

  it("dispatches templates and turns provider failures into terminal events", async () => {
    const options = createOptions();
    pi.harness.promptFromTemplate.mockRejectedValue(
      new Error("provider failed")
    );

    const result = await runPiTurn({
      ...options,
      message: {
        text: "Ignored when a template is selected",
        template: { name: "draft", args: ["zh-TW"] },
      },
    });

    expect(pi.harness.promptFromTemplate).toHaveBeenCalledWith("draft", [
      "zh-TW",
    ]);
    expect(result).toEqual({
      status: "error",
      approvals: [],
      error: "provider failed",
    });
    expect(options.events.slice(-2)).toEqual([
      { type: "error", message: "provider failed" },
      { type: "run:end", reason: "error" },
    ]);
  });

  it("tears down and flushes when approval persistence fails", async () => {
    const options = createOptions();
    const flushEvents = vi.fn(async () => undefined);
    options.persistApproval.mockRejectedValue(
      new Error("database unavailable")
    );
    pi.harness.prompt.mockImplementation(async () => {
      await pi.handlers.get("tool_call")?.({
        type: "tool_call",
        toolCallId: "call-1",
        toolName: "publish",
        input: {},
      });
    });

    await expect(runPiTurn({ ...options, flushEvents })).rejects.toThrow(
      "database unavailable"
    );
    expect(
      pi.unsubscribers.every(
        (unsubscribe) => unsubscribe.mock.calls.length === 1
      )
    ).toBe(true);
    expect(flushEvents).toHaveBeenCalledOnce();
  });

  it("does not compact a successful turn that requests approval", async () => {
    const options = createOptions();
    Object.assign(options.session, {
      getBranch: vi.fn(async () => [
        {
          type: "message",
          id: "entry-1",
          parentId: null,
          timestamp: "2026-01-01T00:00:00.000Z",
          message: { role: "user", content: "x".repeat(400_000) },
        },
      ]),
    });
    pi.harness.prompt.mockImplementation(async () => {
      await pi.handlers.get("tool_call")?.({
        type: "tool_call",
        toolCallId: "call-1",
        toolName: "publish",
        input: {},
      });
    });

    await expect(runPiTurn(options)).resolves.toMatchObject({
      status: "awaiting_approval",
    });
    expect(pi.harness.compact).not.toHaveBeenCalled();
  });

  it("only compacts successful turns without approvals", async () => {
    const clean = createOptions();
    Object.assign(clean.session, {
      getBranch: vi.fn(async () => [
        {
          type: "message",
          id: "entry-1",
          parentId: null,
          timestamp: "2026-01-01T00:00:00.000Z",
          message: { role: "user", content: "x".repeat(400_000) },
        },
      ]),
    });

    await runPiTurn(clean);
    expect(pi.harness.compact).toHaveBeenCalledOnce();

    pi.harness.compact.mockClear();
    pi.harness.prompt.mockRejectedValueOnce(new Error("provider failed"));
    await runPiTurn(createOptions());
    expect(pi.harness.compact).not.toHaveBeenCalled();
  });

  it("keeps a successful turn successful when compaction fails", async () => {
    const options = createOptions();
    Object.assign(options.session, {
      getBranch: vi.fn(async () => [
        {
          type: "message",
          id: "entry-1",
          parentId: null,
          timestamp: "2026-01-01T00:00:00.000Z",
          message: { role: "user", content: "x".repeat(400_000) },
        },
      ]),
    });
    pi.harness.compact.mockRejectedValue(
      new Error("summarisation unavailable")
    );

    await expect(runPiTurn(options)).resolves.toEqual({
      status: "done",
      approvals: [],
      error: undefined,
    });
  });

  it("flushes the event sink when Pi construction fails", async () => {
    const options = createOptions();
    const flushEvents = vi.fn(async () => undefined);
    pi.AgentHarness.mockImplementationOnce(() => {
      throw new Error("harness unavailable");
    });

    await expect(runPiTurn({ ...options, flushEvents })).rejects.toThrow(
      "harness unavailable"
    );
    expect(flushEvents).toHaveBeenCalledOnce();
  });
});
