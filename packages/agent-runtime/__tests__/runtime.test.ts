import type { Context } from "@earendil-works/pi-ai";
import {
  fauxAssistantMessage,
  fauxToolCall,
} from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it, vi } from "vitest";

import { formatOperatorDecision } from "../src/wire/operator-decision.ts";

import {
  build,
  messageOf,
  seedOversizedBranch,
  toolCallTurn,
} from "./runtime.fixture.ts";

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
    // Each assistant:end saw its own entry already in the tree; Pi announces a tool's end
    // before it emits the tool-result message, so that one lands with the next assistant
    // message.
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
      { type: "error", kind: "internal" },
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
      { type: "error", kind: "auth" },
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
      { type: "error", kind: "internal" },
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
      { type: "error", kind: "internal" },
      { type: "run:end", reason: "error" },
    ]);
    expect(flushEvents).toHaveBeenCalledOnce();
  });

  it("fails the turn as internal and persists nothing more when the tree refuses a message", async () => {
    const fixture = build();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const appendEntry = fixture.session.appendEntry.bind(fixture.session);
    const refused = new Error("unsupported Unicode escape sequence");
    vi.spyOn(fixture.session, "appendEntry").mockImplementation((entry) =>
      entry.type === "message" && entry.message.role === "assistant"
        ? Promise.reject(refused)
        : appendEntry(entry)
    );
    fixture.faux.setResponses([fauxAssistantMessage("Never persisted.")]);

    const result = await fixture.run();

    expect(result.status).toBe("error");
    expect(result.error).toEqual({
      kind: "internal",
      message: expect.stringContaining("refused"),
    });
    expect(fixture.events.slice(-2)).toEqual([
      { type: "error", kind: "internal" },
      { type: "run:end", reason: "error" },
    ]);
    // The refused reply never reached the wire, and nothing was hung off its lost parent.
    expect(fixture.types()).not.toContain("assistant:end");
    const branch = await fixture.branch();
    expect(branch.map((entry) => messageOf(entry)?.role)).toEqual(["user"]);
    expect(consoleError).toHaveBeenCalledWith(
      "Agent turn failed",
      expect.objectContaining({ kind: "internal", cause: refused })
    );
    consoleError.mockRestore();
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
