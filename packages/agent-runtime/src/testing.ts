import { EventType } from "@tanstack/ai";
import type {
  AnyTextAdapter,
  StreamChunk,
  TextOptions,
  TokenUsage,
} from "@tanstack/ai";

import type { JsonObject } from "@chia/utils/json";

import type { AgentModel, AgentModelBinding } from "./models.ts";

/**
 * A scripted text adapter for tests: it plays back replies in order and records every request the
 * engine made, so a turn runs through the real engine without a provider.
 */

export interface ScriptedReply {
  text?: string;
  thinking?: { text: string; signature: string };
  /** A reasoning block streamed after the text, as a provider that repeats its reasoning item does. */
  thinkingAfterText?: { text: string; signature: string };
  toolCalls?: { id: string; name: string; args: JsonObject }[];
  usage?: Partial<TokenUsage>;
  /** Fails the provider call with this message. */
  error?: string;
  /** Streams its thinking and text, then waits until the request is aborted, never finishing. */
  hang?: boolean;
  /** Runs when the engine sends this request, before anything streams. */
  onRequest?: (options: TextOptions) => void;
}

export interface ScriptedAdapter {
  adapter: AnyTextAdapter;
  /** Every provider request the engine made, in order. */
  requests: TextOptions[];
  /** Replies not yet played. */
  pending: () => number;
}

const USAGE: TokenUsage = {
  promptTokens: 100,
  completionTokens: 10,
  totalTokens: 110,
};

export const scriptedAdapter = (
  replies: readonly ScriptedReply[]
): ScriptedAdapter => {
  const requests: TextOptions[] = [];
  let next = 0;

  async function* chatStream(
    options: TextOptions
  ): AsyncGenerator<StreamChunk> {
    requests.push(options);
    const reply = replies[next];
    next += 1;
    if (!reply) throw new Error("The script has no reply left.");
    const runId = `run-${next}`;
    const threadId = "thread";
    const timestamp = Date.now();
    yield { type: EventType.RUN_STARTED, runId, threadId, timestamp };
    reply.onRequest?.(options);

    function* reasoning(
      thinking: { text: string; signature: string },
      messageId: string
    ): Generator<StreamChunk> {
      yield { type: EventType.REASONING_START, messageId, timestamp };
      yield {
        type: EventType.REASONING_MESSAGE_START,
        messageId,
        role: "reasoning",
        timestamp,
      };
      yield {
        type: EventType.REASONING_MESSAGE_CONTENT,
        messageId,
        delta: thinking.text,
        timestamp,
      };
      yield { type: EventType.REASONING_MESSAGE_END, messageId, timestamp };
      yield { type: EventType.REASONING_END, messageId, timestamp };
      yield {
        type: EventType.REASONING_ENCRYPTED_VALUE,
        subtype: "message",
        entityId: messageId,
        encryptedValue: thinking.signature,
        timestamp,
      };
    }

    if (reply.thinking) yield* reasoning(reply.thinking, `reasoning-${next}`);

    if (reply.text !== undefined) {
      const messageId = `text-${next}`;
      yield {
        type: EventType.TEXT_MESSAGE_START,
        messageId,
        role: "assistant",
        timestamp,
      };
      yield {
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId,
        delta: reply.text,
        timestamp,
      };
      if (!reply.hang) {
        yield { type: EventType.TEXT_MESSAGE_END, messageId, timestamp };
      }
    }

    if (reply.hang) {
      // The engine hands the adapter its run's signal on the request it would send.
      const signal = options.request?.signal;
      await new Promise<void>((resolve) => {
        if (signal?.aborted) resolve();
        signal?.addEventListener("abort", () => resolve(), { once: true });
      });
      return;
    }

    if (reply.thinkingAfterText) {
      yield* reasoning(reply.thinkingAfterText, `reasoning-${next}-repeat`);
    }

    for (const call of reply.toolCalls ?? []) {
      yield {
        type: EventType.TOOL_CALL_START,
        toolCallId: call.id,
        toolCallName: call.name,
        toolName: call.name,
        timestamp,
      };
      yield {
        type: EventType.TOOL_CALL_ARGS,
        toolCallId: call.id,
        delta: JSON.stringify(call.args),
        timestamp,
      };
      yield {
        type: EventType.TOOL_CALL_END,
        toolCallId: call.id,
        input: call.args,
        timestamp,
      };
    }

    if (reply.error !== undefined) {
      yield {
        type: EventType.RUN_ERROR,
        message: reply.error,
        timestamp,
      };
      return;
    }

    yield {
      type: EventType.RUN_FINISHED,
      runId,
      threadId,
      finishReason: reply.toolCalls?.length ? "tool_calls" : "stop",
      usage: { ...USAGE, ...reply.usage },
      timestamp,
    };
  }

  const adapter: AnyTextAdapter = {
    kind: "text",
    name: "scripted",
    model: "test-model",
    "~types": {
      providerOptions: {},
      inputModalities: ["text"],
      messageMetadataByModality: {},
      toolCapabilities: [],
      toolCallMetadata: undefined,
      systemPromptMetadata: undefined,
    },
    chatStream,
    structuredOutput: () =>
      Promise.reject(new Error("Structured output is not scripted.")),
  };

  return { adapter, requests, pending: () => replies.length - next };
};

export const TEST_MODEL: AgentModel = {
  providerId: "scripted",
  modelId: "test-model",
  name: "Test model",
  contextWindow: 100_000,
  reasoningEfforts: null,
  supportsTemperature: true,
  input: ["text"],
  pricing: {
    input: [{ perToken: 0.000_001, minTokens: 0 }],
    output: [{ perToken: 0.000_002, minTokens: 0 }],
    cacheRead: [{ perToken: 0.000_000_1, minTokens: 0 }],
    cacheWrite: [],
  },
};

export const bindingOf = (
  script: ScriptedAdapter,
  model: AgentModel = TEST_MODEL
): AgentModelBinding => ({
  model,
  adapter: script.adapter,
  api: "scripted",
  modelOptions: {},
  promptTokensIncludeCache: true,
});
