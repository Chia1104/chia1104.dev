const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }));

vi.mock("@chia/observability/report", () => ({ reportError }));

import { getCurrentTools } from "@earendil-works/pi-ai";
import type { TranscriptContext } from "@earendil-works/pi-ai";
import {
  fauxAssistantMessage,
  fauxToolCall,
} from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it, vi } from "vitest";

import { AgentErrorKind, ApprovalVerdict } from "../src/types.ts";

import {
  build,
  messageOf,
  seedOversizedBranch,
  toolCallTurn,
} from "./runtime.fixture.ts";

describe("runTurn", () => {
  it("runs a prompt, persists both messages and owns the wire event lifecycle", async () => {
    const fixture = build();
    const flushEvents = vi.fn(async () => undefined);
    fixture.faux.setResponses([fauxAssistantMessage("Hi there")]);

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

    expect(fixture.calls).toEqual(["typescript"]);
    const branch = await fixture.branch();
    expect(branch.map((entry) => messageOf(entry)?.role)).toEqual([
      "user",
      "assistant",
      "toolResult",
      "assistant",
    ]);
    // Each assistant:end and tool:end saw its own entry already in the tree.
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
  });

  it("names wire messages by the entry ids the tree persists them under", async () => {
    const fixture = build();
    fixture.faux.setResponses([
      toolCallTurn("search", { q: "typescript" }, "call-1"),
      fauxAssistantMessage("Found it."),
    ]);

    await fixture.run();

    const branch = await fixture.branch();
    const wireIds = fixture.events.flatMap((event) =>
      event.type === "user" || event.type === "assistant:end"
        ? [event.messageId]
        : []
    );
    // user, assistant, (toolResult has no wire id), assistant. Live ids are entry ids, so the
    // replayed transcript names the same messages identically and any of them can be a target.
    expect(wireIds).toEqual([branch[0]?.id, branch[1]?.id, branch[3]?.id]);
    const startIds = fixture.events.flatMap((event) =>
      event.type === "assistant:start" ? [event.messageId] : []
    );
    expect(startIds).toEqual([branch[1]?.id, branch[3]?.id]);
  });

  it("stops on gated calls, records the batch, then announces it", async () => {
    const fixture = build();
    fixture.persistApprovals.mockImplementation(async () => {
      // Nothing is announced until the batch is on record.
      expect(
        fixture.events.some((event) => event.type === "approval:request")
      ).toBe(false);
    });
    fixture.faux.setResponses([
      fauxAssistantMessage(
        [
          fauxToolCall("publish", { slug: "hello" }, { id: "call-1" }),
          fauxToolCall("publish", { slug: "second" }, { id: "call-2" }),
        ],
        { stopReason: "toolUse" }
      ),
      fauxAssistantMessage("Never requested."),
    ]);

    const result = await fixture.run();

    expect(fixture.calls).toEqual([]);
    expect(fixture.faux.state.callCount).toBe(1);
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
    // The calls wait with no result, so the turn that resumes them can run them.
    const branch = await fixture.branch();
    expect(branch.map((entry) => messageOf(entry)?.role)).toEqual([
      "user",
      "assistant",
    ]);
  });

  it("holds a batch's other calls with its gated ones and runs them all on resume", async () => {
    const fixture = build();
    fixture.faux.setResponses([
      fauxAssistantMessage(
        [
          fauxToolCall("search", { q: "draft" }, { id: "call-1" }),
          fauxToolCall("publish", { slug: "hello" }, { id: "call-2" }),
        ],
        { stopReason: "toolUse" }
      ),
    ]);
    await fixture.run();
    expect(fixture.calls).toEqual([]);

    fixture.faux.setResponses([fauxAssistantMessage("Published.")]);
    const result = await fixture.resume({
      interruptedRunId: "run-1",
      decisions: [{ toolCallId: "call-2", verdict: ApprovalVerdict.Approved }],
    });

    expect(result).toEqual({ status: "done" });
    expect(fixture.calls).toEqual(["draft", "publish"]);
    const branch = await fixture.branch();
    expect(branch.map((entry) => messageOf(entry)?.role)).toEqual([
      "user",
      "assistant",
      "toolResult",
      "toolResult",
      "assistant",
    ]);
  });

  it("keeps a held batch's invalid call open too, and answers it with its error on resume", async () => {
    const fixture = build();
    fixture.faux.setResponses([
      fauxAssistantMessage(
        [
          // `search` requires `q`: Pi answers it without asking the turn.
          fauxToolCall("search", {}, { id: "call-1" }),
          fauxToolCall("publish", { slug: "hello" }, { id: "call-2" }),
        ],
        { stopReason: "toolUse" }
      ),
    ]);
    await fixture.run();
    expect(
      (await fixture.branch()).map((entry) => messageOf(entry)?.role)
    ).toEqual(["user", "assistant"]);

    fixture.faux.setResponses([fauxAssistantMessage("Published.")]);
    await fixture.resume({
      interruptedRunId: "run-1",
      decisions: [{ toolCallId: "call-2", verdict: ApprovalVerdict.Approved }],
    });

    const results = (await fixture.branch())
      .map(messageOf)
      .filter((message) => message?.role === "toolResult");
    expect(results).toMatchObject([
      { toolCallId: "call-1", isError: true },
      { toolCallId: "call-2", isError: false },
    ]);
    expect(fixture.calls).toEqual(["publish"]);
  });

  it("keeps a held batch's invalid call open when its calls run one at a time", async () => {
    const fixture = build();
    const tools = fixture.options.tools.map((tool) =>
      tool.name === "publish"
        ? { ...tool, executionMode: "sequential" as const }
        : tool
    );
    fixture.faux.setResponses([
      fauxAssistantMessage(
        [
          // Answered by Pi before the gated call after it is ever asked about.
          fauxToolCall("search", {}, { id: "call-1" }),
          fauxToolCall("publish", { slug: "hello" }, { id: "call-2" }),
        ],
        { stopReason: "toolUse" }
      ),
    ]);
    await fixture.run({ tools });
    expect(
      (await fixture.branch()).map((entry) => messageOf(entry)?.role)
    ).toEqual(["user", "assistant"]);

    fixture.faux.setResponses([fauxAssistantMessage("Published.")]);
    const result = await fixture.resume(
      {
        interruptedRunId: "run-1",
        decisions: [
          { toolCallId: "call-2", verdict: ApprovalVerdict.Approved },
        ],
      },
      { tools }
    );

    expect(result).toEqual({ status: "done" });
    expect(fixture.calls).toEqual(["publish"]);
  });

  it("does not grant an approval to a later call that reuses the approved call's id", async () => {
    const fixture = build();
    fixture.faux.setResponses([
      toolCallTurn("publish", { slug: "hello" }, "call-1"),
    ]);
    await fixture.run();

    fixture.faux.setResponses([
      toolCallTurn("publish", { slug: "other" }, "call-1"),
    ]);
    const result = await fixture.resume({
      interruptedRunId: "run-1",
      decisions: [{ toolCallId: "call-1", verdict: ApprovalVerdict.Approved }],
    });

    expect(fixture.calls).toEqual(["publish"]);
    expect(result).toMatchObject({ status: "awaiting_approval" });
    expect(fixture.persistApprovals).toHaveBeenLastCalledWith({
      requests: [
        expect.objectContaining({
          toolCallId: "call-1",
          args: { slug: "other" },
        }),
      ],
      settled: [],
    });
  });

  it("runs an approved call exactly as requested when the turn resumes", async () => {
    const fixture = build();
    fixture.faux.setResponses([
      toolCallTurn("publish", { slug: "hello" }, "call-1"),
    ]);
    await fixture.run();
    fixture.events.length = 0;

    fixture.faux.setResponses([fauxAssistantMessage("Published.")]);
    const result = await fixture.resume({
      interruptedRunId: "run-1",
      decisions: [
        {
          toolCallId: "call-1",
          verdict: ApprovalVerdict.Approved,
          comment: "go",
        },
      ],
    });

    expect(result).toEqual({ status: "done" });
    expect(fixture.calls).toEqual(["publish"]);
    // The resumed reply is not sent to the provider again: only the answer to the result is.
    expect(fixture.faux.state.callCount).toBe(2);
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
    const fixture = build();
    fixture.faux.setResponses([
      toolCallTurn("publish", { slug: "hello" }, "call-1"),
    ]);
    await fixture.run();

    fixture.faux.setResponses([fauxAssistantMessage("Understood.")]);
    await fixture.resume({
      interruptedRunId: "run-1",
      decisions: [
        {
          toolCallId: "call-1",
          verdict: ApprovalVerdict.Declined,
          comment: "fix the title",
        },
      ],
    });

    expect(fixture.calls).toEqual([]);
    expect(messageOf((await fixture.branch())[2])).toMatchObject({
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
    const fixture = build();
    fixture.faux.setResponses([
      toolCallTurn("publish", { slug: "hello" }, "call-1"),
      fauxAssistantMessage("The draft is not ready."),
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
  });

  it("records the calls it refused beside the ones that reach the operator", async () => {
    const fixture = build();
    fixture.faux.setResponses([
      fauxAssistantMessage(
        [
          fauxToolCall("publish", { slug: "ready" }, { id: "call-1" }),
          fauxToolCall("publish", { slug: "empty" }, { id: "call-2" }),
        ],
        { stopReason: "toolUse" }
      ),
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
    const fixture = build();
    fixture.faux.setResponses([
      toolCallTurn("publish", { slug: "hello" }, "call-1"),
    ]);

    const result = await fixture.run({
      approvalKeyOf: (request) => `feed:${JSON.stringify(request.input)}`,
    });

    expect(result).toMatchObject({
      status: "awaiting_approval",
      approvals: [{ toolCallId: "call-1", key: 'feed:{"slug":"hello"}' }],
    });
  });

  it("asks the kind's policy, not a built-in tier table, whether a call is gated", async () => {
    const fixture = build();
    fixture.faux.setResponses([
      toolCallTurn("publish", { slug: "hello" }, "call-1"),
      fauxAssistantMessage("Published."),
    ]);

    // A kind that gates nothing: `commit` means nothing to its policy.
    const result = await fixture.run({
      policy: { ...fixture.options.policy, requiresApproval: () => false },
    });

    expect(result).toEqual({ status: "done" });
    expect(fixture.calls).toEqual(["publish"]);
    expect(fixture.persistApprovals).not.toHaveBeenCalled();
  });

  it("runs a gated tool without asking when the session pre-approved its tier", async () => {
    const fixture = build();
    fixture.faux.setResponses([
      toolCallTurn("publish", { slug: "hello" }, "call-1"),
      fauxAssistantMessage("Published."),
    ]);

    const result = await fixture.run({
      settings: { ...fixture.options.settings, autoApprove: ["commit"] },
    });

    expect(result).toEqual({ status: "done" });
    expect(fixture.calls).toEqual(["publish"]);
    expect(fixture.persistApprovals).not.toHaveBeenCalled();
    expect(fixture.types()).not.toContain("approval:request");
  });

  it("resumes an approved call after the operator pre-approved its tier while it waited", async () => {
    const fixture = build();
    fixture.faux.setResponses([
      toolCallTurn("publish", { slug: "hello" }, "call-1"),
    ]);
    await fixture.run();

    // "Always approve" lands on the session before the decision resumes the turn.
    fixture.faux.setResponses([fauxAssistantMessage("Published.")]);
    const result = await fixture.resume(
      {
        interruptedRunId: "run-1",
        decisions: [
          { toolCallId: "call-1", verdict: ApprovalVerdict.Approved },
        ],
      },
      { settings: { ...fixture.options.settings, autoApprove: ["commit"] } }
    );

    expect(result).toEqual({ status: "done" });
    expect(fixture.calls).toEqual(["publish"]);
  });

  it("counts a gated call it checked once, not again when it runs", async () => {
    const fixture = build();
    fixture.faux.setResponses([
      toolCallTurn("publish", { slug: "hello" }, "call-1"),
      fauxAssistantMessage("Published."),
    ]);
    const preflight = vi.fn(() => undefined);

    await fixture.run({
      preflight,
      settings: { ...fixture.options.settings, autoApprove: ["commit"] },
    });

    expect(preflight).toHaveBeenCalledOnce();
    expect(fixture.calls).toEqual(["publish"]);
  });

  it("fails as internal when there is no stopped reply to resume", async () => {
    const fixture = build();
    fixture.faux.setResponses([fauxAssistantMessage("Hello.")]);
    await fixture.run();

    await expect(
      fixture.resume({
        interruptedRunId: "run-1",
        decisions: [
          { toolCallId: "call-1", verdict: ApprovalVerdict.Approved },
        ],
      })
    ).resolves.toMatchObject({
      status: "error",
      error: { kind: AgentErrorKind.Internal },
    });
  });

  it("expands a prompt template into the persisted user message", async () => {
    const fixture = build();
    const seen: TranscriptContext[] = [];
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
      error: {
        kind: AgentErrorKind.Internal,
        message: "Unknown prompt template: nope",
      },
    });
    expect(fixture.faux.state.callCount).toBe(0);
    expect(fixture.events.slice(-2)).toEqual([
      { type: "error", kind: AgentErrorKind.Internal },
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
      error: {
        kind: AgentErrorKind.Auth,
        message: "401 Unauthorized: invalid x-api-key",
      },
    });
    expect(fixture.events.slice(-2)).toEqual([
      { type: "error", kind: AgentErrorKind.Auth },
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

    expect(result).toMatchObject({
      status: "error",
      error: { message: "provider failed" },
    });
    expect(fixture.events.at(-1)).toEqual({ type: "run:end", reason: "error" });
  });

  it("appends the volatile context as an ephemeral last message", async () => {
    const fixture = build();
    const volatileContext = vi.fn(
      async () => "# Current session\n- draft: empty"
    );
    const seen: TranscriptContext[] = [];
    fixture.faux.setResponses([
      (context) => {
        seen.push(context);
        return fauxAssistantMessage("Noted.");
      },
    ]);

    await fixture.run({ volatileContext });

    expect(volatileContext).toHaveBeenCalledOnce();
    expect(seen[0]?.messages.map((message) => message.role)).toEqual([
      "system",
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
      error: { kind: AgentErrorKind.Internal, message: "draft store down" },
    });
    expect(fixture.events.slice(-2)).toEqual([
      { type: "error", kind: AgentErrorKind.Internal },
      { type: "run:end", reason: "error" },
    ]);
  });

  it("terminalizes and flushes when the batch cannot be recorded", async () => {
    const fixture = build();
    const flushEvents = vi.fn(async () => undefined);
    fixture.persistApprovals.mockRejectedValue(
      new Error("database unavailable")
    );
    fixture.faux.setResponses([toolCallTurn("publish", {}, "call-1")]);

    await expect(fixture.run({ flushEvents })).resolves.toEqual({
      status: "error",
      error: { kind: AgentErrorKind.Internal, message: "database unavailable" },
    });
    // A batch that could not be recorded is never announced.
    expect(fixture.types()).not.toContain("approval:request");
    expect(fixture.events.slice(-2)).toEqual([
      { type: "error", kind: AgentErrorKind.Internal },
      { type: "run:end", reason: "error" },
    ]);
    expect(flushEvents).toHaveBeenCalledOnce();
  });

  it("fails the turn as internal and persists nothing more when the tree refuses a message", async () => {
    const fixture = build();
    reportError.mockClear();
    const appendEntry = fixture.session.appendEntry.bind(fixture.session);
    const refused = new Error("unsupported Unicode escape sequence");
    vi.spyOn(fixture.session, "appendEntry").mockImplementation((entry) =>
      entry.type === "message" && entry.message.role === "assistant"
        ? Promise.reject(refused)
        : appendEntry(entry)
    );
    fixture.faux.setResponses([fauxAssistantMessage("Never persisted.")]);

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
    const fixture = build();
    const seen: TranscriptContext[] = [];
    fixture.faux.setResponses([
      (context) => {
        seen.push(context);
        return fauxAssistantMessage("ok");
      },
    ]);

    await fixture.run({
      settings: { ...fixture.options.settings, activeToolNames: ["search"] },
    });

    expect(
      getCurrentTools(seen[0]?.messages ?? []).map((tool) => tool.name)
    ).toEqual(["search"]);
  });
});
