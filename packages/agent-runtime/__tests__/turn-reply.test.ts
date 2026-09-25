import { EventType } from "@tanstack/ai";
import type { StreamChunk } from "@tanstack/ai";
import { describe, expect, it } from "vitest";

import { StopReason } from "../src/messages.ts";
import { bindingOf, scriptedAdapter } from "../src/testing.ts";
import { startReply } from "../src/turn/reply.ts";

const binding = bindingOf(scriptedAdapter([]));
const timestamp = 0;

const text = (delta: string): StreamChunk => ({
  type: EventType.TEXT_MESSAGE_CONTENT,
  messageId: "m",
  delta,
  timestamp,
});

const reasoning = (delta: string): StreamChunk[] => [
  {
    type: EventType.REASONING_MESSAGE_START,
    messageId: "r",
    role: "reasoning",
    timestamp,
  },
  {
    type: EventType.REASONING_MESSAGE_CONTENT,
    messageId: "r",
    delta,
    timestamp,
  },
];

const signature = (encryptedValue: string): StreamChunk => ({
  type: EventType.REASONING_ENCRYPTED_VALUE,
  subtype: "message",
  entityId: "r",
  encryptedValue,
  timestamp,
});

/** Adapters put a step's signature beside the AG-UI fields of `STEP_FINISHED`. */
const stepFinished = {
  type: EventType.STEP_FINISHED,
  stepName: "thinking",
  signature: "sig-2",
  timestamp,
} as const;

const replyOf = (chunks: readonly StreamChunk[]) => {
  const reply = startReply(binding);
  const deltas = chunks.flatMap((chunk) => reply.apply(chunk) ?? []);
  return { reply, deltas };
};

describe("startReply", () => {
  it("streams text and thinking as deltas under the reply's id", () => {
    const { reply, deltas } = replyOf([...reasoning("Hmm."), text("Hi")]);

    expect(deltas).toEqual([
      {
        type: "assistant:delta",
        messageId: reply.id,
        channel: "thinking",
        delta: "Hmm.",
      },
      {
        type: "assistant:delta",
        messageId: reply.id,
        channel: "text",
        delta: "Hi",
      },
    ]);
    expect(reply.finish(StopReason.Stop, undefined).content).toEqual([
      { type: "thinking", thinking: "Hmm." },
      { type: "text", text: "Hi" },
    ]);
  });

  it("keeps a repeated reasoning item once, with the signature sent last", () => {
    const first = JSON.stringify({ id: "rs_1", v: 1 });
    const repeat = JSON.stringify({ id: "rs_1", v: 2 });
    const { reply } = replyOf([
      ...reasoning("Plan."),
      signature(first),
      text("Answer."),
      ...reasoning("Plan."),
      signature(repeat),
    ]);

    expect(reply.finish(StopReason.Stop, undefined).content).toEqual([
      { type: "thinking", thinking: "Plan.", thinkingSignature: repeat },
      { type: "text", text: "Answer." },
    ]);
  });

  it("signs a reasoning item that streamed no summary, and reads a step's signature", () => {
    const { reply } = replyOf([
      signature("sig-1"),
      ...reasoning("Step."),
      stepFinished,
    ]);

    expect(reply.finish(StopReason.Stop, undefined).content).toEqual([
      { type: "thinking", thinking: "", thinkingSignature: "sig-1" },
      { type: "thinking", thinking: "Step.", thinkingSignature: "sig-2" },
    ]);
  });

  it("takes a call's parsed input, and falls back to its streamed arguments", () => {
    const { reply } = replyOf([
      {
        type: EventType.TOOL_CALL_START,
        toolCallId: "c1",
        toolCallName: "search",
        timestamp,
      },
      {
        type: EventType.TOOL_CALL_END,
        toolCallId: "c1",
        input: { q: "parsed" },
        timestamp,
      },
      {
        type: EventType.TOOL_CALL_START,
        toolCallId: "c2",
        toolCallName: "search",
        timestamp,
      },
      {
        type: EventType.TOOL_CALL_ARGS,
        toolCallId: "c2",
        delta: '{"q":"streamed"}',
        timestamp,
      },
      {
        type: EventType.TOOL_CALL_START,
        toolCallId: "c3",
        toolCallName: "search",
        timestamp,
      },
      {
        type: EventType.TOOL_CALL_ARGS,
        toolCallId: "c3",
        delta: '{"q":',
        timestamp,
      },
    ]);

    expect(reply.finish(StopReason.Aborted, undefined).content).toEqual([
      {
        type: "toolCall",
        id: "c1",
        name: "search",
        arguments: { q: "parsed" },
      },
      {
        type: "toolCall",
        id: "c2",
        name: "search",
        arguments: { q: "streamed" },
      },
      { type: "toolCall", id: "c3", name: "search", arguments: {} },
    ]);
  });

  it("records the binding's wire and model, prices the usage and keeps the error text", () => {
    const { reply } = replyOf([text("Partial")]);
    const message = reply.finish(
      StopReason.Error,
      { promptTokens: 100, completionTokens: 10, totalTokens: 110 },
      "boom"
    );

    expect(message).toMatchObject({
      role: "assistant",
      api: binding.api,
      provider: binding.model.providerId,
      model: binding.model.modelId,
      stopReason: StopReason.Error,
      errorMessage: "boom",
      usage: { input: 100, output: 10, totalTokens: 110 },
    });
    expect(message.usage.cost.total).toBeGreaterThan(0);
  });
});
