import { randomUUID } from "node:crypto";

import type { StreamChunk, TokenUsage } from "@tanstack/ai";
import * as z from "zod";

import { asJsonObject } from "@chia/utils/json";

import type {
  AssistantMessage,
  TextContent,
  ThinkingContent,
  ToolCallContent,
} from "../messages.ts";
import { emptyUsage, StopReason } from "../messages.ts";
import type { AgentModelBinding } from "../models.ts";
import { usageOf } from "../models.ts";
import type { AgentWireEvent } from "../wire/schema.ts";

export const stopReasonOf = (
  finishReason: string | null | undefined
): StopReason =>
  finishReason === "tool_calls"
    ? StopReason.ToolUse
    : finishReason === "length"
      ? StopReason.Length
      : StopReason.Stop;

const reasoningItemSchema = z.object({ id: z.string() }).loose();

/**
 * Which reasoning item a signature belongs to: the item id an OpenAI-shaped signature carries, or
 * the signature itself.
 */
const reasoningIdentity = (signature: string): string => {
  try {
    return (
      reasoningItemSchema.safeParse(JSON.parse(signature)).data?.id ?? signature
    );
  } catch {
    return signature;
  }
};

/** Fields the adapters put on `STEP_FINISHED` beside the AG-UI ones. */
const stepFinishedSchema = z
  .object({ signature: z.string().optional() })
  .loose();

/** One model call's reply as it streams; `finish` turns it into the message the tree stores. */
export interface Reply {
  /** The entry id, which is also the message id on the wire. */
  readonly id: string;
  /** Folds a chunk in; returns the delta clients stream when the chunk carried text or thinking. */
  apply: (chunk: StreamChunk) => AgentWireEvent | undefined;
  finish: (
    stopReason: StopReason,
    usage: TokenUsage | undefined,
    errorMessage?: string
  ) => AssistantMessage;
}

export const startReply = (
  binding: Pick<AgentModelBinding, "api" | "model" | "promptTokensIncludeCache">
): Reply => {
  const id = randomUUID();
  let parts: (TextContent | ThinkingContent | ToolCallContent)[] = [];
  let text: TextContent | undefined;
  let thinking: ThinkingContent | undefined;
  /** Streamed arguments, read only when the adapter never reports them parsed. */
  const args = new Map<string, { part: ToolCallContent; buffer: string }>();

  /**
   * A provider may repeat a reasoning item; the wire takes each one back exactly once, with the
   * signature it sent last.
   */
  const sign = (signature: string | undefined) => {
    if (!signature) return;
    const identity = reasoningIdentity(signature);
    const earlier = parts.find(
      (part): part is ThinkingContent =>
        part.type === "thinking" &&
        part.thinkingSignature !== undefined &&
        reasoningIdentity(part.thinkingSignature) === identity
    );
    if (earlier) {
      earlier.thinkingSignature = signature;
      const repeat = thinking;
      if (repeat && repeat !== earlier) {
        parts = parts.filter((part) => part !== repeat);
      }
      thinking = undefined;
      return;
    }
    // A reasoning item may carry only its signature, with no summary text streamed.
    const signed =
      thinking && thinking.thinkingSignature === undefined
        ? thinking
        : { type: "thinking" as const, thinking: "" };
    if (signed !== thinking) parts.push(signed);
    signed.thinkingSignature = signature;
    thinking = undefined;
  };

  return {
    id,
    apply: (chunk) => {
      switch (chunk.type) {
        case "TEXT_MESSAGE_CONTENT": {
          if (!text) {
            text = { type: "text", text: "" };
            parts.push(text);
          }
          text.text += chunk.delta;
          return {
            type: "assistant:delta",
            messageId: id,
            channel: "text",
            delta: chunk.delta,
          };
        }
        case "REASONING_MESSAGE_START": {
          thinking = { type: "thinking", thinking: "" };
          parts.push(thinking);
          text = undefined;
          return undefined;
        }
        case "REASONING_MESSAGE_CONTENT": {
          if (!thinking) {
            thinking = { type: "thinking", thinking: "" };
            parts.push(thinking);
          }
          thinking.thinking += chunk.delta;
          return {
            type: "assistant:delta",
            messageId: id,
            channel: "thinking",
            delta: chunk.delta,
          };
        }
        case "STEP_FINISHED": {
          sign(stepFinishedSchema.safeParse(chunk).data?.signature);
          return undefined;
        }
        case "REASONING_ENCRYPTED_VALUE": {
          if (chunk.subtype === "message") sign(chunk.encryptedValue);
          return undefined;
        }
        case "TOOL_CALL_START": {
          const part: ToolCallContent = {
            type: "toolCall",
            id: chunk.toolCallId,
            name: chunk.toolCallName,
            arguments: {},
          };
          parts.push(part);
          args.set(chunk.toolCallId, { part, buffer: "" });
          text = undefined;
          return undefined;
        }
        case "TOOL_CALL_ARGS": {
          const call = args.get(chunk.toolCallId);
          if (call) call.buffer += chunk.delta;
          return undefined;
        }
        case "TOOL_CALL_END": {
          const call = args.get(chunk.toolCallId);
          const input = asJsonObject(chunk.input);
          if (call && input) call.part.arguments = input;
          return undefined;
        }
        default:
          return undefined;
      }
    },
    finish: (stopReason, usage, errorMessage) => {
      for (const call of args.values()) {
        if (Object.keys(call.part.arguments).length > 0) continue;
        try {
          call.part.arguments =
            asJsonObject(JSON.parse(call.buffer || "{}")) ?? {};
        } catch {
          call.part.arguments = {};
        }
      }
      return {
        role: "assistant",
        // A repeated reasoning item leaves an empty part with nothing to send back.
        content: parts.filter(
          (part) =>
            part.type !== "thinking" ||
            part.thinking.length > 0 ||
            part.thinkingSignature !== undefined
        ),
        api: binding.api,
        provider: binding.model.providerId,
        model: binding.model.modelId,
        usage: usage ? usageOf(binding, usage) : emptyUsage(),
        stopReason,
        ...(errorMessage !== undefined && { errorMessage }),
        timestamp: Date.now(),
      };
    },
  };
};
