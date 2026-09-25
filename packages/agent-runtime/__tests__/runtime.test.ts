const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }));

vi.mock("@chia/observability/report", () => ({ reportError }));

import type { ModelMessage } from "@tanstack/ai";
import { describe, expect, it, vi } from "vitest";

import type { SessionEntry } from "../src/session/entries.ts";
import { AgentErrorKind } from "../src/types.ts";
import type { AgentWireEvent } from "../src/wire/schema.ts";

import {
  build,
  messageOf,
  seedOversizedBranch,
  toolCall,
} from "./runtime.fixture.ts";

const textOf = (
  content: ModelMessage | readonly ModelMessage[] | readonly SessionEntry[]
) => JSON.stringify(content);

describe("runTurn", () => {
  it("runs a prompt, persists both messages and owns the wire event lifecycle", async () => {
    const fixture = build([{ text: "Hi there" }]);
    const flushEvents = vi.fn(async () => undefined);

    const result = await fixture.run({ flushEvents });

    expect(result).toEqual({ status: "done" });
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
    const fixture = build([
      toolCall("search", { q: "typescript" }, "call-1"),
      { text: "Found it." },
    ]);
    const seenAtEvent: number[] = [];

    await fixture.run({
      onEvent: (event: AgentWireEvent) => {
        fixture.events.push(event);
        if (event.type === "assistant:end" || event.type === "tool:end") {
          void fixture.session
            .getEntries()
            .then((entries) => seenAtEvent.push(entries.length));
        }
      },
    });

    expect(fixture.calls).toEqual(["typescript"]);
    const branch = await fixture.branch();
    expect(branch.map((entry) => messageOf(entry)?.role)).toEqual([
      "user",
      "assistant",
      "toolResult",
      "assistant",
    ]);
    // Every event saw its own entry already in the tree.
    expect(seenAtEvent).toEqual([2, 3, 4]);
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
    // The tool's details are the client's; the model read only its text.
    const result = messageOf(branch[2]);
    expect(result).toMatchObject({
      role: "toolResult",
      toolName: "search",
      isError: false,
      details: { q: "typescript" },
      content: [{ type: "text", text: "results for typescript" }],
    });
    expect(textOf(fixture.sent(1))).not.toContain('"q"');
  });

  it("names wire messages by the entry ids the tree persists them under", async () => {
    const fixture = build([
      toolCall("search", { q: "typescript" }, "call-1"),
      { text: "Found it." },
    ]);

    await fixture.run();

    const branch = await fixture.branch();
    const wireIds = fixture.events.flatMap((event) =>
      event.type === "user" || event.type === "assistant:end"
        ? [event.messageId]
        : []
    );
    // user, assistant, (a tool result has no wire id), assistant. Live ids are entry ids, so the
    // replayed transcript names the same messages identically and any of them can be a target.
    expect(wireIds).toEqual([branch[0]?.id, branch[1]?.id, branch[3]?.id]);
    const startIds = fixture.events.flatMap((event) =>
      event.type === "assistant:start" ? [event.messageId] : []
    );
    expect(startIds).toEqual([branch[1]?.id, branch[3]?.id]);
  });

  it("stops on gated calls, records the batch, then announces it", async () => {
    const fixture = build([
      {
        toolCalls: [
          { id: "call-1", name: "publish", args: { slug: "hello" } },
          { id: "call-2", name: "publish", args: { slug: "second" } },
        ],
      },
    ]);
    fixture.persistApprovals.mockImplementation(async () => {
      // Nothing is announced until the batch is on record.
      expect(
        fixture.events.some((event) => event.type === "approval:request")
      ).toBe(false);
    });

    const result = await fixture.run();

    expect(fixture.calls).toEqual([]);
    expect(result).toMatchObject({
      status: "awaiting_approval",
      approvals: [
        expect.objectContaining({ toolCallId: "call-1", tier: "commit" }),
        expect.objectContaining({ toolCallId: "call-2", tier: "commit" }),
      ],
    });
    expect(fixture.persistApprovals).toHaveBeenCalledExactlyOnceWith({
      requests: [
        expect.objectContaining({
          toolCallId: "call-1",
          key: 'publish:{"slug":"hello"}',
        }),
        expect.objectContaining({
          toolCallId: "call-2",
          key: 'publish:{"slug":"second"}',
        }),
      ],
      settled: [],
    });
    expect(fixture.types().slice(-3)).toEqual([
      "approval:request",
      "approval:request",
      "run:end",
    ]);
    expect(fixture.events.at(-1)).toEqual({
      type: "run:end",
      reason: "awaiting_approval",
    });
    // The calls wait with no result, so the engine can run them once they are answered.
    const branch = await fixture.branch();
    expect(branch.map((entry) => messageOf(entry)?.role)).toEqual([
      "user",
      "assistant",
    ]);
  });

  it("runs an approved call exactly as requested when the turn resumes", async () => {
    const fixture = build([
      toolCall("publish", { slug: "hello" }, "call-1"),
      { text: "Published." },
    ]);
    await fixture.run();
    fixture.events.length = 0;

    const result = await fixture.run({
      agentRunId: "run-2",
      message: undefined,
      resume: {
        interruptedRunId: "run-1",
        decisions: [{ toolCallId: "call-1", approved: true, comment: "go" }],
      },
    });

    expect(result).toEqual({ status: "done" });
    expect(fixture.calls).toEqual(["publish:hello"]);
    expect(fixture.types()).toEqual([
      "run:start",
      "approval:resolved",
      "tool:end",
      "assistant:start",
      "assistant:end",
      "run:end",
    ]);
    expect(fixture.events[1]).toEqual({
      type: "approval:resolved",
      toolCallId: "call-1",
      approved: true,
      comment: "go",
    });
    const branch = await fixture.branch();
    expect(branch.map((entry) => messageOf(entry)?.role)).toEqual([
      "user",
      "assistant",
      "toolResult",
      "assistant",
    ]);
    expect(messageOf(branch[2])).toMatchObject({
      toolCallId: "call-1",
      isError: false,
    });
  });

  it("answers a declined call with the operator's words and records the decline", async () => {
    const fixture = build([
      toolCall("publish", { slug: "hello" }, "call-1"),
      { text: "Understood." },
    ]);
    await fixture.run();

    await fixture.run({
      agentRunId: "run-2",
      message: undefined,
      resume: {
        interruptedRunId: "run-1",
        decisions: [
          { toolCallId: "call-1", approved: false, comment: "fix the title" },
        ],
      },
    });

    expect(fixture.calls).toEqual([]);
    const result = messageOf((await fixture.branch())[2]);
    expect(result).toMatchObject({
      role: "toolResult",
      toolCallId: "call-1",
      isError: true,
      declined: { comment: "fix the title" },
      content: [
        {
          type: "text",
          text: "The operator declined this call: fix the title",
        },
      ],
    });
  });

  it("answers a gated call the preflight refuses without reaching the operator", async () => {
    const fixture = build([
      toolCall("publish", { slug: "hello" }, "call-1"),
      { text: "The draft is not ready." },
    ]);

    const result = await fixture.run({
      preflight: (request) =>
        request.toolName === "publish"
          ? { reason: "The draft is empty." }
          : undefined,
    });

    expect(result).toEqual({ status: "done" });
    expect(fixture.persistApprovals).not.toHaveBeenCalled();
    expect(fixture.types()).not.toContain("approval:request");
    const branch = await fixture.branch();
    expect(messageOf(branch[2])).toMatchObject({
      role: "toolResult",
      isError: true,
      content: [{ type: "text", text: "The draft is empty." }],
    });
    expect(messageOf(branch[2])).not.toHaveProperty("declined");
    expect(fixture.script.pending()).toBe(0);
  });

  it("records the calls it refused beside the ones that reach the operator", async () => {
    const fixture = build([
      {
        toolCalls: [
          { id: "call-1", name: "publish", args: { slug: "ready" } },
          { id: "call-2", name: "publish", args: { slug: "empty" } },
        ],
      },
    ]);

    const result = await fixture.run({
      preflight: (request) =>
        JSON.stringify(request.input).includes("empty")
          ? { reason: "The draft is empty." }
          : undefined,
    });

    expect(result).toMatchObject({
      status: "awaiting_approval",
      approvals: [expect.objectContaining({ toolCallId: "call-1" })],
    });
    expect(fixture.persistApprovals).toHaveBeenCalledExactlyOnceWith({
      requests: [expect.objectContaining({ toolCallId: "call-1" })],
      settled: [
        expect.objectContaining({
          toolCallId: "call-2",
          approved: false,
          reason: "The draft is empty.",
        }),
      ],
    });
  });

  it("records a request under the kind's approval key, never the call id", async () => {
    const fixture = build([toolCall("publish", { slug: "hello" }, "call-1")]);

    const result = await fixture.run({
      approvalKeyOf: (request) => `feed:${JSON.stringify(request.input)}`,
    });

    expect(result).toMatchObject({
      status: "awaiting_approval",
      approvals: [{ toolCallId: "call-1", key: 'feed:{"slug":"hello"}' }],
    });
  });

  it("asks the kind's policy, not a built-in tier table, whether a call is gated", async () => {
    const fixture = build([
      toolCall("publish", { slug: "hello" }, "call-1"),
      { text: "Published." },
    ]);

    // A kind that gates nothing: `commit` means nothing to its policy.
    const result = await fixture.run({
      policy: { ...fixture.options.policy, requiresApproval: () => false },
    });

    expect(result).toEqual({ status: "done" });
    expect(fixture.calls).toEqual(["publish:hello"]);
    expect(fixture.persistApprovals).not.toHaveBeenCalled();
  });

  it("runs a gated tool without asking when the session pre-approved its tier", async () => {
    const fixture = build([
      toolCall("publish", { slug: "hello" }, "call-1"),
      { text: "Published." },
    ]);

    const result = await fixture.run({
      settings: { ...fixture.options.settings, autoApprove: ["commit"] },
    });

    expect(result).toEqual({ status: "done" });
    expect(fixture.calls).toEqual(["publish:hello"]);
    expect(fixture.persistApprovals).not.toHaveBeenCalled();
    expect(fixture.types()).not.toContain("approval:request");
  });

  it("resumes an approved call after the operator pre-approved its tier while it waited", async () => {
    const fixture = build([
      toolCall("publish", { slug: "hello" }, "call-1"),
      { text: "Published." },
    ]);
    await fixture.run();

    // "Always approve" lands on the session before the decision resumes the turn.
    const result = await fixture.run({
      agentRunId: "run-2",
      settings: { ...fixture.options.settings, autoApprove: ["commit"] },
      message: undefined,
      resume: {
        interruptedRunId: "run-1",
        decisions: [{ toolCallId: "call-1", approved: true }],
      },
    });

    expect(result).toEqual({ status: "done" });
    expect(fixture.calls).toEqual(["publish:hello"]);
  });

  it("counts a gated call it checked once, not again when it runs", async () => {
    const fixture = build([
      toolCall("publish", { slug: "hello" }, "call-1"),
      { text: "Published." },
    ]);
    const preflight = vi.fn(() => undefined);

    await fixture.run({
      preflight,
      settings: { ...fixture.options.settings, autoApprove: ["commit"] },
    });

    expect(preflight).toHaveBeenCalledOnce();
    expect(fixture.calls).toEqual(["publish:hello"]);
  });

  it("keeps going for as many model calls as the budget allows", async () => {
    const searches = Array.from({ length: 7 }, (_, index) =>
      toolCall("search", { q: `query ${index}` }, `call-${index}`)
    );
    const fixture = build([...searches, { text: "Found them." }]);

    const result = await fixture.run({
      budget: {
        ...fixture.options.budget,
        maxToolCalls: 10,
        hardMaxToolCalls: 12,
      },
    });

    expect(result).toEqual({ status: "done" });
    expect(fixture.calls).toHaveLength(7);
    expect(fixture.script.pending()).toBe(0);
    expect(messageOf((await fixture.branch()).at(-1))).toMatchObject({
      role: "assistant",
      stopReason: "stop",
    });
  });

  it("announces the state a successful call changed", async () => {
    const fixture = build([
      toolCall("search", { q: "x" }, "call-1"),
      { text: "Done." },
    ]);

    await fixture.run({
      policy: {
        ...fixture.options.policy,
        toolInfo: (toolName) => ({
          label: toolName,
          tier: "read",
          changes: "draft",
        }),
      },
    });

    expect(fixture.events).toContainEqual({
      type: "state:changed",
      scope: "draft",
      revision: 1,
    });
  });

  it("expands a prompt template into the persisted user message", async () => {
    const fixture = build([{ text: "Drafting." }]);

    await fixture.run({
      promptTemplates: [{ name: "draft", content: "Draft a post in $1." }],
      message: {
        text: "Ignored when a template is selected",
        template: { name: "draft", args: ["zh-TW"] },
      },
    });

    expect(fixture.sent(0).at(-1)?.content).toBe("Draft a post in zh-TW.");
    const first = messageOf((await fixture.branch())[0]);
    expect(first?.role === "user" ? first.content : undefined).toBe(
      "Draft a post in zh-TW."
    );
  });

  it("fails as internal when the template is unknown, before any provider call", async () => {
    const fixture = build();

    const result = await fixture.run({
      promptTemplates: [],
      message: { text: "", template: { name: "nope" } },
    });

    expect(result).toEqual({
      status: "error",
      error: {
        kind: AgentErrorKind.Internal,
        message: "Unknown prompt template: nope",
      },
    });
    expect(fixture.script.requests).toHaveLength(0);
    expect(fixture.events.slice(-2)).toEqual([
      { type: "error", kind: AgentErrorKind.Internal },
      { type: "run:end", reason: "error" },
    ]);
  });

  it("classifies a provider failure and keeps the failed reply out of the model's context", async () => {
    const fixture = build([{ error: "401 Unauthorized: invalid x-api-key" }]);
    await seedOversizedBranch(fixture.session);

    await expect(fixture.run()).resolves.toEqual({
      status: "error",
      error: {
        kind: AgentErrorKind.Auth,
        message: "401 Unauthorized: invalid x-api-key",
      },
    });
    expect(fixture.events.slice(-2)).toEqual([
      { type: "error", kind: AgentErrorKind.Auth },
      { type: "run:end", reason: "error" },
    ]);
    const branch = await fixture.branch();
    expect(messageOf(branch.at(-1))).toMatchObject({
      role: "assistant",
      stopReason: "error",
      errorMessage: "401 Unauthorized: invalid x-api-key",
    });
    // A failed turn is never compacted.
    expect(branch.some((entry) => entry.type === "compaction")).toBe(false);
  });

  it("reports a provider that throws instead of streaming", async () => {
    const fixture = build();
    fixture.options.binding.adapter.chatStream = () => {
      throw new Error("provider failed");
    };

    const result = await fixture.run();

    expect(result).toMatchObject({
      status: "error",
      error: { kind: AgentErrorKind.Provider, message: "provider failed" },
    });
    expect(fixture.events.at(-1)).toEqual({ type: "run:end", reason: "error" });
  });

  it("sends the volatile context on every request and never persists it", async () => {
    const fixture = build([
      toolCall("search", { q: "x" }, "call-1"),
      { text: "Noted." },
    ]);
    const volatileContext = vi.fn(
      async () => "# Current session\n- draft: empty"
    );

    await fixture.run({ volatileContext });

    expect(volatileContext).toHaveBeenCalledTimes(2);
    for (const index of [0, 1]) {
      expect(fixture.sent(index).at(-1)).toEqual({
        role: "user",
        content: "# Current session\n- draft: empty",
      });
    }
    // The second request carries it once: the first request's copy was never history.
    expect(
      fixture
        .sent(1)
        .filter((message) => textOf(message).includes("# Current session"))
    ).toHaveLength(1);
    expect(textOf(await fixture.session.getEntries())).not.toContain(
      "# Current session"
    );
  });

  it("fails the turn as internal when the volatile context cannot be read", async () => {
    const fixture = build([{ text: "Should not matter." }]);

    await expect(
      fixture.run({
        volatileContext: async () => {
          throw new Error("draft store down");
        },
      })
    ).resolves.toEqual({
      status: "error",
      error: { kind: AgentErrorKind.Internal, message: "draft store down" },
    });
    expect(fixture.events.slice(-2)).toEqual([
      { type: "error", kind: AgentErrorKind.Internal },
      { type: "run:end", reason: "error" },
    ]);
  });

  it("terminalizes and flushes when the batch cannot be recorded", async () => {
    const fixture = build([toolCall("publish", {}, "call-1")]);
    const flushEvents = vi.fn(async () => undefined);
    fixture.persistApprovals.mockRejectedValue(
      new Error("database unavailable")
    );

    await expect(fixture.run({ flushEvents })).resolves.toEqual({
      status: "error",
      error: { kind: AgentErrorKind.Internal, message: "database unavailable" },
    });
    // A request that is not on record is never announced.
    expect(fixture.types()).not.toContain("approval:request");
    expect(fixture.events.slice(-2)).toEqual([
      { type: "error", kind: AgentErrorKind.Internal },
      { type: "run:end", reason: "error" },
    ]);
    expect(flushEvents).toHaveBeenCalledOnce();
  });

  it("fails the turn as internal and persists nothing more when the tree refuses a message", async () => {
    const fixture = build([{ text: "Never persisted." }]);
    reportError.mockClear();
    const appendEntry = fixture.session.appendEntry.bind(fixture.session);
    const refused = new Error("unsupported Unicode escape sequence");
    vi.spyOn(fixture.session, "appendEntry").mockImplementation((entry) =>
      entry.type === "message" && entry.message.role === "assistant"
        ? Promise.reject(refused)
        : appendEntry(entry)
    );

    const result = await fixture.run();

    expect(result).toEqual({
      status: "error",
      error: {
        kind: AgentErrorKind.Internal,
        message: expect.stringContaining("refused"),
      },
    });
    expect(fixture.events.slice(-2)).toEqual([
      { type: "error", kind: AgentErrorKind.Internal },
      { type: "run:end", reason: "error" },
    ]);
    // The refused reply never reached the wire, and nothing was hung off its lost parent.
    expect(fixture.types()).not.toContain("assistant:end");
    const branch = await fixture.branch();
    expect(branch.map((entry) => messageOf(entry)?.role)).toEqual(["user"]);
    expect(reportError).toHaveBeenCalledWith(
      refused,
      "Agent turn failed",
      expect.objectContaining({ kind: AgentErrorKind.Internal })
    );
  });

  it("flushes the event sink when the turn cannot be set up", async () => {
    const fixture = build();
    const flushEvents = vi.fn(async () => undefined);

    vi.spyOn(fixture.session, "getLeafId").mockRejectedValue(
      new Error("tree unavailable")
    );

    await expect(fixture.run({ flushEvents })).rejects.toThrow(
      "tree unavailable"
    );
    expect(flushEvents).toHaveBeenCalledOnce();
  });

  it("only exposes the session's active tools to the model", async () => {
    const fixture = build([{ text: "ok" }]);

    await fixture.run({
      settings: { ...fixture.options.settings, activeToolNames: ["search"] },
    });

    expect(fixture.script.requests[0]?.tools?.map((tool) => tool.name)).toEqual(
      ["search"]
    );
  });

  it("keeps one reasoning block per item when the provider repeats it", async () => {
    const item = (encrypted: string) =>
      JSON.stringify({ id: "rs_1", encrypted_content: encrypted });
    const fixture = build([
      {
        thinking: { text: "Think.", signature: item("first") },
        text: "Done.",
        thinkingAfterText: { text: "", signature: item("final") },
      },
    ]);

    await fixture.run();

    const reply = messageOf((await fixture.branch())[1]);
    expect(
      reply?.role === "assistant"
        ? reply.content.filter((part) => part.type === "thinking")
        : undefined
    ).toEqual([
      {
        type: "thinking",
        thinking: "Think.",
        thinkingSignature: item("final"),
      },
    ]);
  });

  it("records a signed reasoning block and sends it back to the same wire only", async () => {
    const fixture = build([
      {
        thinking: { text: "Think.", signature: "sig-1" },
        ...toolCall("search", { q: "x" }, "call-1"),
      },
      { text: "Done." },
    ]);

    await fixture.run();

    const reply = messageOf((await fixture.branch())[1]);
    expect(reply?.role === "assistant" ? reply.content[0] : undefined).toEqual({
      type: "thinking",
      thinking: "Think.",
      thinkingSignature: "sig-1",
    });
    expect(fixture.sent(1)[1]).toMatchObject({
      role: "assistant",
      thinking: [{ content: "Think.", signature: "sig-1" }],
    });
  });
});
