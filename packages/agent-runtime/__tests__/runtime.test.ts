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
    abort: vi.fn(),
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

/** Pi resolves a turn with the final assistant message; these are the shapes runPiTurn reads. */
const reply = (
  stopReason: "stop" | "error" | "aborted",
  errorMessage?: string
) => ({ role: "assistant", stopReason, errorMessage, content: [] });

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
    persistApprovals: vi.fn(async () => undefined),
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
  pi.harness.prompt.mockReset().mockResolvedValue(reply("stop"));
  pi.harness.promptFromTemplate.mockReset().mockResolvedValue(reply("stop"));
  pi.harness.abort.mockReset().mockResolvedValue(undefined);
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

  it("atomically persists approval requests before publishing them", async () => {
    const options = createOptions();
    options.persistApprovals.mockImplementation(async () => {
      expect(
        options.events.some((event) => event.type === "approval:request")
      ).toBe(false);
    });
    pi.harness.prompt.mockImplementation(async () => {
      const handler = pi.handlers.get("tool_call");
      await handler?.({
        type: "tool_call",
        toolCallId: "call-1",
        toolName: "publish",
        input: { slug: "hello" },
      });
      await handler?.({
        type: "tool_call",
        toolCallId: "call-2",
        toolName: "publish",
        input: { slug: "second" },
      });
      return reply("stop");
    });

    const result = await runPiTurn(options);

    expect(options.persistApprovals).toHaveBeenCalledOnce();
    expect(options.persistApprovals).toHaveBeenCalledWith(["call-1", "call-2"]);
    expect(result).toEqual({
      status: "awaiting_approval",
      approvals: ["call-1", "call-2"],
      error: undefined,
    });
    expect(
      options.events
        .filter((event) => event.type === "approval:request")
        .map((event) => event.toolCallId)
    ).toEqual(["call-1", "call-2"]);
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
      error: { kind: "internal", message: "provider failed" },
    });
    expect(options.events.slice(-2)).toEqual([
      { type: "error", kind: "internal", message: "provider failed" },
      { type: "run:end", reason: "error" },
    ]);
  });

  it("classifies a provider failure that Pi resolves as an error message", async () => {
    const options = createOptions();
    pi.harness.prompt.mockResolvedValue(
      reply("error", "401 Unauthorized: invalid x-api-key")
    );

    await expect(runPiTurn(options)).resolves.toEqual({
      status: "error",
      approvals: [],
      error: { kind: "auth", message: "401 Unauthorized: invalid x-api-key" },
    });
    expect(options.events.slice(-2)).toEqual([
      {
        type: "error",
        kind: "auth",
        message: "401 Unauthorized: invalid x-api-key",
      },
      { type: "run:end", reason: "error" },
    ]);
    expect(pi.harness.compact).not.toHaveBeenCalled();
  });

  it("ends an aborted turn without approvals, compaction or an error", async () => {
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
      return reply("aborted");
    });

    await expect(runPiTurn(options)).resolves.toEqual({
      status: "aborted",
      approvals: [],
      error: undefined,
    });
    expect(options.persistApprovals).not.toHaveBeenCalled();
    expect(pi.harness.compact).not.toHaveBeenCalled();
    expect(options.events.at(-1)).toEqual({
      type: "run:end",
      reason: "aborted",
    });
  });

  it("aborts the harness at the provider boundary when the host says so", async () => {
    const options = createOptions();
    const shouldAbort = vi.fn(async () => true);
    pi.harness.prompt.mockImplementation(async () => {
      await pi.handlers.get("before_provider_request")?.({
        type: "before_provider_request",
      });
      return reply("aborted");
    });

    await runPiTurn({ ...options, shouldAbort });

    expect(shouldAbort).toHaveBeenCalledOnce();
    expect(pi.harness.abort).toHaveBeenCalledOnce();
  });

  it("does not poll or abort when the host has no abort signal", async () => {
    const options = createOptions();
    await runPiTurn(options);
    expect(pi.handlers.has("before_provider_request")).toBe(false);
  });

  it("appends the volatile context as an ephemeral last message", async () => {
    const options = createOptions();
    const volatileContext = vi.fn(
      async () => "# Current session\n- draft: empty"
    );
    let transformed: unknown;
    pi.harness.prompt.mockImplementation(async () => {
      transformed = await pi.handlers.get("context")?.({
        type: "context",
        messages: [{ role: "user", content: "Hello", timestamp: 1 }],
      });
      return reply("stop");
    });

    await runPiTurn({ ...options, volatileContext });

    expect(volatileContext).toHaveBeenCalledOnce();
    expect(transformed).toEqual({
      messages: [
        { role: "user", content: "Hello", timestamp: 1 },
        {
          role: "user",
          content: [
            { type: "text", text: "# Current session\n- draft: empty" },
          ],
          timestamp: expect.any(Number),
        },
      ],
    });
    // Nothing about the ephemeral block reaches the wire.
    expect(options.events.map((event) => event.type)).toEqual([
      "run:start",
      "user",
      "run:end",
    ]);
  });

  it("drops the volatile context for a request when reading it fails", async () => {
    const options = createOptions();
    let transformed: unknown = "unset";
    pi.harness.prompt.mockImplementation(async () => {
      transformed = await pi.handlers.get("context")?.({
        type: "context",
        messages: [],
      });
      return reply("stop");
    });

    await expect(
      runPiTurn({
        ...options,
        volatileContext: async () => {
          throw new Error("draft store down");
        },
      })
    ).resolves.toMatchObject({ status: "done" });
    expect(transformed).toBeUndefined();
  });

  it("terminalizes and flushes when approval persistence fails", async () => {
    const options = createOptions();
    const flushEvents = vi.fn(async () => undefined);
    options.persistApprovals.mockRejectedValue(
      new Error("database unavailable")
    );
    pi.harness.prompt.mockImplementation(async () => {
      await pi.handlers.get("tool_call")?.({
        type: "tool_call",
        toolCallId: "call-1",
        toolName: "publish",
        input: {},
      });
      return reply("stop");
    });

    await expect(runPiTurn({ ...options, flushEvents })).resolves.toEqual({
      status: "error",
      approvals: [],
      error: { kind: "internal", message: "database unavailable" },
    });
    expect(options.events).not.toContainEqual(
      expect.objectContaining({ type: "approval:request" })
    );
    expect(options.events.slice(-2)).toEqual([
      { type: "error", kind: "internal", message: "database unavailable" },
      { type: "run:end", reason: "error" },
    ]);
    expect(
      pi.unsubscribers.every(
        (unsubscribe) => unsubscribe.mock.calls.length === 1
      )
    ).toBe(true);
    expect(flushEvents).toHaveBeenCalledOnce();
  });

  it("does not persist approvals raised by a failed provider turn", async () => {
    const options = createOptions();
    pi.harness.prompt.mockImplementation(async () => {
      await pi.handlers.get("tool_call")?.({
        type: "tool_call",
        toolCallId: "call-1",
        toolName: "publish",
        input: {},
      });
      throw new Error("provider failed");
    });

    await expect(runPiTurn(options)).resolves.toEqual({
      status: "error",
      approvals: [],
      error: { kind: "internal", message: "provider failed" },
    });
    expect(options.persistApprovals).not.toHaveBeenCalled();
    expect(options.events).not.toContainEqual(
      expect.objectContaining({ type: "approval:request" })
    );
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
      return reply("stop");
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
    const failed = createOptions();
    Object.assign(failed.session, { getBranch: clean.session.getBranch });
    pi.harness.prompt.mockRejectedValueOnce(new Error("provider failed"));
    await runPiTurn(failed);
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
