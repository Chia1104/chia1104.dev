import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import { createModels } from "@earendil-works/pi-ai";
import type { Context } from "@earendil-works/pi-ai";
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it, vi } from "vitest";

import { runPiTurn } from "../src/pi/turn.ts";
import type { RunPiTurnOptions } from "../src/pi/turn.ts";
import type { SessionEntry } from "../src/session/entries.ts";
import { InMemorySessionTree } from "../src/session/tree.ts";
import { textResult, toolDefiner, Type } from "../src/tools.ts";
import type { AgentPolicy, AgentTurnBudget } from "../src/types.ts";
import { formatOperatorDecision } from "../src/wire/operator-decision.ts";
import type { AgentWireEvent } from "../src/wire/schema.ts";

/**
 * `runPiTurn` against the real `Agent`, scripted through pi-ai's faux provider, over an in-memory
 * session tree. What these pin is the host's side of the turn: hook composition, persistence
 * order, abort semantics, approval and compaction gating, and the wire lifecycle.
 */

interface TestContext {
  calls: string[];
}

const define = toolDefiner<TestContext>();

const searchTool = define({
  name: "search",
  label: "Search",
  description: "Search posts.",
  parameters: Type.Object({ q: Type.String() }),
  execute: async (_toolCallId, params, _signal, _onUpdate, context) => {
    context.calls.push(params.q);
    return textResult(`results for ${params.q}`, { q: params.q });
  },
});

const publishTool = define({
  name: "publish",
  label: "Publish",
  description: "Publish a post.",
  parameters: Type.Object({ slug: Type.Optional(Type.String()) }),
  execute: async (_toolCallId, _params, _signal, _onUpdate, context) => {
    context.calls.push("publish");
    return textResult("published", {});
  },
});

/** Blocks until the run is aborted, so a deadline can fire mid-tool. */
const waitTool = define({
  name: "wait",
  label: "Wait",
  description: "Wait forever.",
  parameters: Type.Object({}),
  execute: (_toolCallId, _params, signal) =>
    new Promise<AgentToolResult<unknown>>((_resolve, reject) => {
      const fail = () => reject(new Error("aborted"));
      if (signal?.aborted) fail();
      signal?.addEventListener("abort", fail, { once: true });
    }),
});

const policy: AgentPolicy = {
  tierOf: (toolName) => (toolName === "publish" ? "commit" : "read"),
  labelOf: (toolName) => toolName,
  requiresApproval: (tier) => tier === "commit",
  summarize: () => "",
};

const budget: AgentTurnBudget = {
  maxToolCalls: 3,
  hardMaxToolCalls: 5,
  maxRepeats: 2,
  maxDurationMs: 60_000,
};

const toolCallTurn = (
  name: string,
  args: Parameters<typeof fauxToolCall>[1],
  id: string
) =>
  fauxAssistantMessage([fauxToolCall(name, args, { id })], {
    stopReason: "toolUse",
  });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A branch already at the compaction threshold: ~100k tokens on a 100k window. */
const seedOversizedBranch = (session: InMemorySessionTree) =>
  session.appendEntry({
    type: "message",
    id: "entry-1",
    parentId: null,
    timestamp: 1,
    message: { role: "user", content: "x".repeat(400_000), timestamp: 1 },
  });

const build = (fauxOptions: { tokensPerSecond?: number } = {}) => {
  const faux = fauxProvider({
    provider: "faux",
    models: [{ id: "test-model", contextWindow: 100_000 }],
    ...fauxOptions,
  });
  const models = createModels();
  models.setProvider(faux.provider);
  const session = new InMemorySessionTree("session-1");
  const events: AgentWireEvent[] = [];
  const context: TestContext = { calls: [] };
  const persistApprovals = vi.fn(
    async (_approvals: readonly string[]): Promise<void> => undefined
  );

  const options: RunPiTurnOptions<TestContext, string> = {
    agentSessionId: "session-1",
    session,
    settings: {
      providerId: "faux",
      modelId: "test-model",
      thinkingLevel: "off",
      activeToolNames: null,
      autoApprove: [],
    },
    model: faux.getModel(),
    models,
    tools: [searchTool, publishTool, waitTool],
    toolContext: context,
    systemPrompt: "You are a test.",
    policy,
    budget,
    message: { text: "Hello" },
    onEvent: (event) => events.push(event),
    toApproval: (approval) => approval.toolCallId,
    persistApprovals,
  };

  return {
    faux,
    session,
    events,
    context,
    persistApprovals,
    options,
    types: () =>
      events
        .map((event) => event.type)
        .filter((type) => type !== "assistant:delta"),
    branch: () => session.getBranch(),
    run: (overrides: Partial<RunPiTurnOptions<TestContext, string>> = {}) =>
      runPiTurn({ ...options, ...overrides }),
  };
};

const messageOf = (entry: SessionEntry | undefined) =>
  entry?.type === "message" ? entry.message : undefined;

describe("runPiTurn", () => {
  it("runs a prompt, persists both messages and owns the wire event lifecycle", async () => {
    const fixture = build();
    const flushEvents = vi.fn(async () => undefined);
    fixture.faux.setResponses([fauxAssistantMessage("Hi there")]);

    const result = await fixture.run({ flushEvents });

    expect(result).toEqual({ status: "done", approvals: [], error: undefined });
    expect(fixture.types()).toEqual([
      "run:start",
      "user",
      "assistant:start",
      "assistant:end",
      "run:end",
    ]);
    const branch = await fixture.branch();
    expect(branch.map((entry) => messageOf(entry)?.role)).toEqual([
      "user",
      "assistant",
    ]);
    expect(branch[1]?.parentId).toBe(branch[0]?.id);
    await expect(fixture.session.getLeafId()).resolves.toBe(branch[1]?.id);
    expect(flushEvents).toHaveBeenCalledOnce();
  });

  it("persists each message before its wire event and threads tool results into the tree", async () => {
    const fixture = build();
    const seenAtEvent: number[] = [];
    fixture.faux.setResponses([
      toolCallTurn("search", { q: "typescript" }, "call-1"),
      fauxAssistantMessage("Found it."),
    ]);

    await fixture.run({
      onEvent: async (event) => {
        fixture.events.push(event);
        if (event.type === "assistant:end" || event.type === "tool:end") {
          seenAtEvent.push((await fixture.session.getBranch()).length);
        }
      },
    });

    expect(fixture.context.calls).toEqual(["typescript"]);
    const branch = await fixture.branch();
    expect(branch.map((entry) => messageOf(entry)?.role)).toEqual([
      "user",
      "assistant",
      "toolResult",
      "assistant",
    ]);
    // Each assistant:end saw its own entry already in the tree; Pi announces a tool's end before
    // it emits the tool-result message, so that one lands with the next assistant message.
    expect(seenAtEvent).toEqual([2, 2, 4]);
    expect(fixture.types()).toEqual([
      "run:start",
      "user",
      "assistant:start",
      "assistant:end",
      "tool:start",
      "tool:end",
      "assistant:start",
      "assistant:end",
      "run:end",
    ]);
  });

  it("announces approval requests as they are refused and persists them atomically at the end", async () => {
    const fixture = build();
    fixture.persistApprovals.mockImplementation(async () => {
      // The client has already been told, so the card can replace the tool while the model is
      // still writing; the durable request is the one thing that waits for the turn to succeed.
      expect(
        fixture.events.filter((event) => event.type === "approval:request")
      ).toHaveLength(2);
    });
    fixture.faux.setResponses([
      fauxAssistantMessage(
        [
          fauxToolCall("publish", { slug: "hello" }, { id: "call-1" }),
          fauxToolCall("publish", { slug: "second" }, { id: "call-2" }),
        ],
        { stopReason: "toolUse" }
      ),
      fauxAssistantMessage("Waiting for approval."),
    ]);

    const result = await fixture.run();

    expect(fixture.context.calls).toEqual([]);
    expect(fixture.persistApprovals).toHaveBeenCalledOnce();
    expect(fixture.persistApprovals).toHaveBeenCalledWith(["call-1", "call-2"]);
    expect(result).toEqual({
      status: "awaiting_approval",
      approvals: ["call-1", "call-2"],
      error: undefined,
    });
    expect(
      fixture.events
        .filter((event) => event.type === "approval:request")
        .map((event) => event.toolCallId)
    ).toEqual(["call-1", "call-2"]);
    // The refusal reaches the model as an error tool result that tells it to stop.
    const refusals = (await fixture.branch())
      .map(messageOf)
      .filter((message) => message?.role === "toolResult");
    expect(refusals).toHaveLength(2);
    expect(refusals.every((message) => message?.isError)).toBe(true);
  });

  it("relays an operator decision before the model runs and marks its own message as synthesised", async () => {
    const fixture = build();
    const text = formatOperatorDecision({
      toolName: "publish",
      approved: true,
      comment: "go",
    });
    fixture.faux.setResponses([fauxAssistantMessage("Publishing.")]);

    await fixture.run({
      message: {
        text,
        decision: {
          toolCallId: "call-1",
          toolName: "publish",
          approved: true,
          comment: "go",
        },
      },
    });

    expect(fixture.events.slice(0, 3)).toEqual([
      { type: "run:start", sessionId: "session-1" },
      {
        type: "approval:resolved",
        toolCallId: "call-1",
        approved: true,
        comment: "go",
      },
      expect.objectContaining({
        type: "user",
        text,
        origin: "operator-decision",
      }),
    ]);
    const first = messageOf((await fixture.branch())[0]);
    expect(first?.role === "user" ? first.content : undefined).toEqual([
      { type: "text", text },
    ]);
  });

  it("expands a prompt template into the persisted user message", async () => {
    const fixture = build();
    const seen: Context[] = [];
    fixture.faux.setResponses([
      (context) => {
        seen.push(context);
        return fauxAssistantMessage("Drafting.");
      },
    ]);

    await fixture.run({
      promptTemplates: [{ name: "draft", content: "Draft a post in $1." }],
      message: {
        text: "Ignored when a template is selected",
        template: { name: "draft", args: ["zh-TW"] },
      },
    });

    expect(seen[0]?.messages.at(-1)?.content).toEqual([
      { type: "text", text: "Draft a post in zh-TW." },
    ]);
    const first = messageOf((await fixture.branch())[0]);
    expect(first?.role === "user" ? first.content : undefined).toEqual([
      { type: "text", text: "Draft a post in zh-TW." },
    ]);
  });

  it("fails as internal when the template is unknown, before any provider call", async () => {
    const fixture = build();

    const result = await fixture.run({
      promptTemplates: [],
      message: { text: "", template: { name: "nope" } },
    });

    expect(result).toEqual({
      status: "error",
      approvals: [],
      error: { kind: "internal", message: "Unknown prompt template: nope" },
    });
    expect(fixture.faux.state.callCount).toBe(0);
    expect(fixture.events.slice(-2)).toEqual([
      {
        type: "error",
        kind: "internal",
        message: "Unknown prompt template: nope",
      },
      { type: "run:end", reason: "error" },
    ]);
  });

  it("classifies a provider failure that Pi resolves as an error message", async () => {
    const fixture = build();
    await seedOversizedBranch(fixture.session);
    fixture.faux.setResponses([
      fauxAssistantMessage("", {
        stopReason: "error",
        errorMessage: "401 Unauthorized: invalid x-api-key",
      }),
    ]);

    await expect(fixture.run()).resolves.toEqual({
      status: "error",
      approvals: [],
      error: { kind: "auth", message: "401 Unauthorized: invalid x-api-key" },
    });
    expect(fixture.events.slice(-2)).toEqual([
      {
        type: "error",
        kind: "auth",
        message: "401 Unauthorized: invalid x-api-key",
      },
      { type: "run:end", reason: "error" },
    ]);
    // A failed turn is never compacted.
    expect((await fixture.branch()).some((e) => e.type === "compaction")).toBe(
      false
    );
  });

  it("reports a provider that throws instead of streaming", async () => {
    const fixture = build();
    fixture.faux.setResponses([
      () => {
        throw new Error("provider failed");
      },
    ]);

    const result = await fixture.run();

    expect(result.status).toBe("error");
    expect(result.error?.message).toBe("provider failed");
    expect(fixture.events.at(-1)).toEqual({ type: "run:end", reason: "error" });
  });

  it("ends an aborted turn without approvals, compaction or an error", async () => {
    const fixture = build();
    await seedOversizedBranch(fixture.session);
    const controller = new AbortController();
    fixture.faux.setResponses([
      toolCallTurn("publish", {}, "call-1"),
      () => {
        controller.abort();
        return fauxAssistantMessage("", { stopReason: "aborted" });
      },
    ]);

    await expect(fixture.run({ signal: controller.signal })).resolves.toEqual({
      status: "aborted",
      approvals: [],
      error: undefined,
    });
    expect(fixture.persistApprovals).not.toHaveBeenCalled();
    expect((await fixture.branch()).some((e) => e.type === "compaction")).toBe(
      false
    );
    expect(fixture.events.at(-1)).toEqual({
      type: "run:end",
      reason: "aborted",
    });
  });

  it("stops mid-generation the moment the host signal fires and persists the partial reply", async () => {
    // ~50 tokens at 25 tokens/s: a couple of seconds of streaming, aborted after the first delta.
    const fixture = build({ tokensPerSecond: 25 });
    const text = Array.from(
      { length: 40 },
      (_, i) => `sentence number ${i} of a deliberately long answer.`
    ).join(" ");
    fixture.faux.setResponses([fauxAssistantMessage(text)]);
    const controller = new AbortController();

    let firstDelta: () => void = () => undefined;
    const streamedSomething = new Promise<void>((resolve) => {
      firstDelta = resolve;
    });
    const pending = fixture.run({
      signal: controller.signal,
      onEvent: (event) => {
        fixture.events.push(event);
        if (event.type === "assistant:delta") firstDelta();
      },
    });
    await streamedSomething;
    controller.abort();
    const result = await pending;

    expect(result.status).toBe("aborted");
    expect(fixture.events.at(-1)).toEqual({
      type: "run:end",
      reason: "aborted",
    });
    const last = messageOf((await fixture.branch()).at(-1));
    expect(last?.role).toBe("assistant");
    expect(last?.role === "assistant" ? last.stopReason : undefined).toBe(
      "aborted"
    );
  });

  it("skips the provider when the signal fires before the run is armed", async () => {
    const fixture = build();
    const controller = new AbortController();
    const getBranch = fixture.session.getBranch.bind(fixture.session);
    // The abort lands while the turn is still reading the tree, before any run exists to cancel.
    fixture.session.getBranch = async (fromId) => {
      controller.abort();
      return getBranch(fromId);
    };
    fixture.faux.setResponses([fauxAssistantMessage("Never sent.")]);

    const result = await fixture.run({ signal: controller.signal });

    expect(result.status).toBe("aborted");
    expect(fixture.faux.state.callCount).toBe(0);
    expect(await fixture.branch()).toEqual([]);
  });

  it("skips the provider entirely when the signal is already aborted", async () => {
    const fixture = build();
    const controller = new AbortController();
    controller.abort();
    fixture.faux.setResponses([fauxAssistantMessage("Never sent.")]);

    const result = await fixture.run({ signal: controller.signal });

    expect(fixture.faux.state.callCount).toBe(0);
    expect(result.status).toBe("aborted");
  });

  it("does not persist approvals or compact when the abort lands after the reply", async () => {
    const fixture = build();
    await seedOversizedBranch(fixture.session);
    const controller = new AbortController();
    fixture.faux.setResponses([
      toolCallTurn("publish", {}, "call-1"),
      fauxAssistantMessage("Waiting."),
    ]);

    const result = await fixture.run({
      signal: controller.signal,
      onEvent: (event) => {
        fixture.events.push(event);
        // The provider turn completes normally; the operator stops in the same instant.
        if (event.type === "assistant:end" && event.text === "Waiting.") {
          controller.abort();
        }
      },
    });

    expect(result).toEqual({
      status: "aborted",
      approvals: [],
      error: undefined,
    });
    expect(fixture.persistApprovals).not.toHaveBeenCalled();
    expect((await fixture.branch()).some((e) => e.type === "compaction")).toBe(
      false
    );
    // Announced live when refused; the client retracts it on `run:end{aborted}`.
    expect(fixture.events).toContainEqual(
      expect.objectContaining({
        type: "approval:request",
        toolCallId: "call-1",
      })
    );
    expect(fixture.events.at(-1)).toEqual({
      type: "run:end",
      reason: "aborted",
    });
  });

  it("refuses tool calls past the soft budget and the gate never sees them", async () => {
    const fixture = build();
    fixture.faux.setResponses([
      toolCallTurn("search", { q: "0" }, "call-0"),
      toolCallTurn("search", { q: "1" }, "call-1"),
      toolCallTurn("search", { q: "2" }, "call-2"),
      toolCallTurn("publish", { slug: "late" }, "call-3"),
      fauxAssistantMessage("Answering from what I have."),
    ]);

    const result = await fixture.run();

    expect(fixture.context.calls).toEqual(["0", "1", "2"]);
    const toolResults = (await fixture.branch())
      .map(messageOf)
      .filter((message) => message?.role === "toolResult");
    expect(toolResults.map((message) => message?.isError)).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(JSON.stringify(toolResults[3]?.content)).toMatch(/budget/i);
    // The fourth call was a gated `publish`; the budget refused it first, so no approval exists.
    expect(fixture.persistApprovals).not.toHaveBeenCalled();
    expect(result.status).toBe("done");
  });

  it("ends the turn as budget_exhausted once the model calls through the hard limit", async () => {
    const fixture = build();
    fixture.faux.setResponses([
      ...Array.from({ length: 6 }, (_, index) =>
        toolCallTurn("search", { q: String(index) }, `call-${index}`)
      ),
      fauxAssistantMessage("Still going."),
    ]);

    const result = await fixture.run();

    expect(result).toMatchObject({
      status: "error",
      error: { kind: "budget_exhausted" },
    });
    expect(fixture.context.calls).toEqual(["0", "1", "2"]);
    expect(fixture.events.at(-1)).toEqual({ type: "run:end", reason: "error" });
  });

  it("ends the turn as budget_exhausted when the wall-clock runs out mid-generation", async () => {
    const fixture = build();
    fixture.faux.setResponses([
      toolCallTurn("wait", {}, "call-1"),
      fauxAssistantMessage("Done waiting."),
    ]);

    const result = await fixture.run({
      budget: { ...budget, maxDurationMs: 40 },
    });

    expect(result).toMatchObject({
      status: "error",
      error: {
        kind: "budget_exhausted",
        message: expect.stringMatching(/ran longer than/),
      },
    });
    expect(fixture.events.at(-1)).toEqual({ type: "run:end", reason: "error" });
  });

  it("does not fail a turn whose deadline passes while approvals are being persisted", async () => {
    const fixture = build();
    fixture.faux.setResponses([
      toolCallTurn("publish", {}, "call-1"),
      fauxAssistantMessage("Waiting."),
    ]);
    fixture.persistApprovals.mockImplementation(async () => {
      // The model already stopped; only host work is left when the deadline would fire.
      await sleep(80);
    });

    const result = await fixture.run({
      budget: { ...budget, maxDurationMs: 40 },
    });

    expect(result).toMatchObject({
      status: "awaiting_approval",
      approvals: ["call-1"],
    });
  });

  it("stops listening once the turn is over", async () => {
    const fixture = build();
    const controller = new AbortController();
    fixture.faux.setResponses([fauxAssistantMessage("Done.")]);

    const result = await fixture.run({
      signal: controller.signal,
      budget: { ...budget, maxDurationMs: 40 },
    });
    const count = fixture.events.length;
    controller.abort();
    await sleep(60);

    expect(result.status).toBe("done");
    expect(fixture.events).toHaveLength(count);
  });

  it("appends the volatile context as an ephemeral last message", async () => {
    const fixture = build();
    const volatileContext = vi.fn(
      async () => "# Current session\n- draft: empty"
    );
    const seen: Context[] = [];
    fixture.faux.setResponses([
      (context) => {
        seen.push(context);
        return fauxAssistantMessage("Noted.");
      },
    ]);

    await fixture.run({ volatileContext });

    expect(volatileContext).toHaveBeenCalledOnce();
    expect(seen[0]?.messages.map((message) => message.role)).toEqual([
      "user",
      "user",
    ]);
    expect(JSON.stringify(seen[0]?.messages.at(-1)?.content)).toContain(
      "# Current session"
    );
    // Nothing about the ephemeral block reaches the wire or the tree.
    expect(fixture.types()).toEqual([
      "run:start",
      "user",
      "assistant:start",
      "assistant:end",
      "run:end",
    ]);
    expect(JSON.stringify(await fixture.branch())).not.toContain(
      "# Current session"
    );
  });

  it("fails the turn as internal when the volatile context cannot be read", async () => {
    const fixture = build();
    fixture.faux.setResponses([fauxAssistantMessage("Should not matter.")]);

    await expect(
      fixture.run({
        volatileContext: async () => {
          throw new Error("draft store down");
        },
      })
    ).resolves.toEqual({
      status: "error",
      approvals: [],
      error: { kind: "internal", message: "draft store down" },
    });
    expect(fixture.events.slice(-2)).toEqual([
      { type: "error", kind: "internal", message: "draft store down" },
      { type: "run:end", reason: "error" },
    ]);
  });

  it("terminalizes and flushes when approval persistence fails", async () => {
    const fixture = build();
    const flushEvents = vi.fn(async () => undefined);
    fixture.persistApprovals.mockRejectedValue(
      new Error("database unavailable")
    );
    fixture.faux.setResponses([
      toolCallTurn("publish", {}, "call-1"),
      fauxAssistantMessage("Waiting."),
    ]);

    await expect(fixture.run({ flushEvents })).resolves.toEqual({
      status: "error",
      approvals: [],
      error: { kind: "internal", message: "database unavailable" },
    });
    expect(fixture.events).toContainEqual(
      expect.objectContaining({
        type: "approval:request",
        toolCallId: "call-1",
      })
    );
    expect(fixture.events.slice(-2)).toEqual([
      { type: "error", kind: "internal", message: "database unavailable" },
      { type: "run:end", reason: "error" },
    ]);
    expect(flushEvents).toHaveBeenCalledOnce();
  });

  it("does not persist approvals raised by a failed provider turn", async () => {
    const fixture = build();
    fixture.faux.setResponses([
      toolCallTurn("publish", {}, "call-1"),
      fauxAssistantMessage("", {
        stopReason: "error",
        errorMessage: "503 overloaded",
      }),
    ]);

    await expect(fixture.run()).resolves.toEqual({
      status: "error",
      approvals: [],
      error: { kind: "rate_limited", message: "503 overloaded" },
    });
    expect(fixture.persistApprovals).not.toHaveBeenCalled();
    expect(fixture.events).toContainEqual(
      expect.objectContaining({
        type: "approval:request",
        toolCallId: "call-1",
      })
    );
    expect(fixture.events.at(-1)).toEqual({ type: "run:end", reason: "error" });
  });

  it("does not compact a successful turn that requests approval", async () => {
    const fixture = build();
    await seedOversizedBranch(fixture.session);
    fixture.faux.setResponses([
      toolCallTurn("publish", {}, "call-1"),
      fauxAssistantMessage("Waiting."),
    ]);

    await expect(fixture.run()).resolves.toMatchObject({
      status: "awaiting_approval",
    });
    expect((await fixture.branch()).some((e) => e.type === "compaction")).toBe(
      false
    );
  });

  it("compacts a successful, approval-free turn under context pressure and announces it", async () => {
    const fixture = build();
    await seedOversizedBranch(fixture.session);
    fixture.faux.setResponses([
      fauxAssistantMessage("Sure."),
      // Consumed by compaction's summary request.
      fauxAssistantMessage("Everything so far, condensed."),
    ]);

    const result = await fixture.run();

    expect(result.status).toBe("done");
    const branch = await fixture.branch();
    const compaction = branch.find((entry) => entry.type === "compaction");
    expect(compaction).toMatchObject({
      summary: "Everything so far, condensed.",
      retainedTail: expect.any(Array),
    });
    // The compaction is the new leaf, so the next turn starts from the summary.
    await expect(fixture.session.getLeafId()).resolves.toBe(compaction?.id);
    expect(fixture.events.slice(-2)).toEqual([
      expect.objectContaining({
        type: "session:compacted",
        summary: "Everything so far, condensed.",
      }),
      { type: "run:end", reason: "done" },
    ]);
  });

  it("leaves a branch inside the window alone", async () => {
    const fixture = build();
    fixture.faux.setResponses([fauxAssistantMessage("Small talk.")]);

    await fixture.run();

    expect((await fixture.branch()).some((e) => e.type === "compaction")).toBe(
      false
    );
    expect(fixture.faux.getPendingResponseCount()).toBe(0);
  });

  it("keeps a successful turn successful when compaction fails", async () => {
    const fixture = build();
    await seedOversizedBranch(fixture.session);
    // No response scripted for the summary request: compaction fails, the turn does not.
    fixture.faux.setResponses([fauxAssistantMessage("Sure.")]);

    await expect(fixture.run()).resolves.toEqual({
      status: "done",
      approvals: [],
      error: undefined,
    });
    expect((await fixture.branch()).some((e) => e.type === "compaction")).toBe(
      false
    );
  });

  it("flushes the event sink when the turn cannot be set up", async () => {
    const fixture = build();
    const flushEvents = vi.fn(async () => undefined);

    await expect(
      fixture.run({
        flushEvents,
        toolContext: () => {
          throw new Error("ports unavailable");
        },
      })
    ).rejects.toThrow("ports unavailable");
    expect(flushEvents).toHaveBeenCalledOnce();
  });

  it("only exposes the session's active tools to the model", async () => {
    const fixture = build();
    const seen: Context[] = [];
    fixture.faux.setResponses([
      (context) => {
        seen.push(context);
        return fauxAssistantMessage("ok");
      },
    ]);

    await fixture.run({
      settings: { ...fixture.options.settings, activeToolNames: ["search"] },
    });

    expect(seen[0]?.tools?.map((tool) => tool.name)).toEqual(["search"]);
  });
});
