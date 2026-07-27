import { EventType } from "@tanstack/ai";

import type { AgentWireEvent } from "@chia/agent-core";

import { toAgentUiEventStream } from "../orpc/agent-ai-transport";

const eventStream = async function* (
  events: readonly AgentWireEvent[]
): AsyncGenerator<AgentWireEvent, void, void> {
  for (const event of events) yield event;
};

const collect = async (events: readonly AgentWireEvent[]) => {
  const chunks = [];
  for await (const chunk of toAgentUiEventStream(eventStream(events), {
    threadId: "session-1",
    runId: "client-run-1",
  })) {
    chunks.push(chunk);
  }
  return chunks;
};

describe("agent AG-UI transport", () => {
  it("streams text and reconciles the authoritative final message", async () => {
    const chunks = await collect([
      { type: "run:start", sessionId: "session-1" },
      { type: "assistant:start", messageId: "a1" },
      {
        type: "assistant:delta",
        messageId: "a1",
        channel: "text",
        delta: "Hel",
      },
      { type: "assistant:end", messageId: "a1", text: "Hello" },
      { type: "run:end", reason: "done" },
    ]);

    expect(chunks.map((chunk) => chunk.type)).toEqual([
      EventType.RUN_STARTED,
      EventType.TEXT_MESSAGE_START,
      EventType.TEXT_MESSAGE_CONTENT,
      EventType.TEXT_MESSAGE_CONTENT,
      EventType.TEXT_MESSAGE_END,
      EventType.RUN_FINISHED,
    ]);
    expect(
      chunks
        .filter((chunk) => chunk.type === EventType.TEXT_MESSAGE_CONTENT)
        .map((chunk) => chunk.delta)
    ).toEqual(["Hel", "lo"]);
    expect(chunks.at(-1)).toMatchObject({
      type: EventType.RUN_FINISHED,
      threadId: "session-1",
      runId: "client-run-1",
      finishReason: "stop",
    });
  });

  it("keeps a gated tool in approval-requested instead of reporting the gate refusal", async () => {
    const chunks = await collect([
      { type: "assistant:start", messageId: "a1" },
      {
        type: "tool:start",
        toolCallId: "call-1",
        toolName: "commit",
        label: "Commit",
        tier: "commit",
        args: { title: "Post" },
      },
      {
        type: "approval:request",
        toolCallId: "call-1",
        toolName: "commit",
        tier: "commit",
        args: { title: "Post" },
      },
      {
        type: "tool:end",
        toolCallId: "call-1",
        toolName: "commit",
        isError: true,
        summary: "Needs approval",
      },
      { type: "run:end", reason: "awaiting_approval" },
    ]);

    expect(chunks).toContainEqual(
      expect.objectContaining({
        type: EventType.CUSTOM,
        name: "approval-requested",
        value: expect.objectContaining({
          toolCallId: "client-run-1:call-1",
          approval: {
            id: "call-1",
            needsApproval: true,
          },
        }),
      })
    );
    expect(
      chunks.some((chunk) => chunk.type === EventType.TOOL_CALL_RESULT)
    ).toBe(false);
  });

  it("emits completed server tool results without asking TanStack to continue the model loop", async () => {
    const chunks = await collect([
      { type: "assistant:start", messageId: "a1" },
      {
        type: "tool:start",
        toolCallId: "call-1",
        toolName: "read",
        label: "Read",
        tier: "read",
        args: { id: 1 },
      },
      {
        type: "tool:end",
        toolCallId: "call-1",
        toolName: "read",
        isError: false,
        summary: "Found it",
        details: { id: 1 },
      },
      { type: "run:end", reason: "done" },
    ]);

    expect(chunks).toContainEqual(
      expect.objectContaining({
        type: EventType.TOOL_CALL_RESULT,
        toolCallId: "client-run-1:call-1",
        state: "output-available",
      })
    );
    expect(chunks.at(-1)).toMatchObject({
      type: EventType.RUN_FINISHED,
      finishReason: "stop",
    });
  });
});
