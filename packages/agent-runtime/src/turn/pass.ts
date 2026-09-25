import { randomUUID } from "node:crypto";

import { chat } from "@tanstack/ai";
import type {
  ChatMiddleware,
  ModelMessage,
  RunAgentResumeItem,
  StreamChunk,
  TokenUsage,
} from "@tanstack/ai";

import { AgentUsageSource } from "@chia/db/schema";
import { isAbortError } from "@chia/utils/error-helper";

import { errorOfProviderMessage, errorOfThrown } from "../errors.ts";
import { StopReason } from "../messages.ts";
import type { AgentModelBinding } from "../models.ts";
import { tokenUsageOf } from "../models.ts";
import { modelSpans } from "../telemetry.ts";
import { AgentErrorKind } from "../types.ts";
import type {
  AgentPolicy,
  AgentUsageListener,
  ToolCallRefusal,
  ToolCallRequest,
} from "../types.ts";
import {
  assistantEndEvent,
  toolEndEvent,
  toolStartEvent,
} from "../wire/replay.ts";
import type { AgentWireEvent } from "../wire/schema.ts";

import type { TurnControl, TurnFailure } from "./control.ts";
import { toolResultMessageOf } from "./engine-tools.ts";
import type { EngineTools } from "./engine-tools.ts";
import { startReply, stopReasonOf } from "./reply.ts";
import type { Reply } from "./reply.ts";
import type { TurnTranscript } from "./transcript.ts";

/** What the turn knows about its calls across engine passes. */
export interface TurnCalls {
  /** Tool names by call id; a result carries its call's name. */
  names: Map<string, string>;
  /** Gated calls the turn checked before answering them; they are not counted twice. */
  checked: Set<string>;
  /** Calls the turn's own checks answered in place of the tool; they read as errors. */
  refused: Map<string, string>;
  /** Calls the operator declined, answered on this resume; the transcript records it. */
  declined: ReadonlyMap<string, { comment?: string }>;
  /** Bumped by every successful call that changes kind state. */
  stateRevision: number;
}

/** The turn an engine pass runs inside. */
export interface PassContext {
  sessionId: string;
  binding: AgentModelBinding;
  systemPrompt: string;
  volatileContext?: () => string | undefined | Promise<string | undefined>;
  policy: AgentPolicy;
  tools: EngineTools;
  /** The checks every call passes, gated or not, before it runs or reaches the operator. */
  check: (request: ToolCallRequest) => Promise<ToolCallRefusal | undefined>;
  calls: TurnCalls;
  control: TurnControl;
  transcript: TurnTranscript;
  onEvent: (event: AgentWireEvent) => void;
  onUsage?: AgentUsageListener;
}

export interface PassRequest {
  messages: ModelMessage[];
  runId: string;
  parentRunId?: string;
  resume?: RunAgentResumeItem[];
}

export type PassResult =
  | { status: "done" }
  | { status: "aborted" }
  | { status: "error"; failure: TurnFailure }
  | { status: "interrupted"; toolCallIds: string[] };

/**
 * One engine run over the branch the request projects. Every reply and tool result is persisted
 * and announced as its chunk arrives; the run ends done, aborted, failed or stopped on gated calls.
 */
export const runPass = async (
  context: PassContext,
  request: PassRequest
): Promise<PassResult> => {
  const {
    binding,
    policy,
    calls,
    control,
    transcript,
    onEvent,
    volatileContext,
  } = context;
  let reply: Reply | undefined;
  let providerError: string | undefined;
  let interrupted: string[] | undefined;
  let finished = false;

  /** Persists the open reply, then announces it and the calls it made. */
  const persistReply = async (
    stopReason: StopReason,
    usage: TokenUsage | undefined,
    errorMessage?: string
  ) => {
    const open = reply;
    reply = undefined;
    if (!open) return;
    const assistant = open.finish(stopReason, usage, errorMessage);
    // An unfinished reply's calls never run; the live view shows no card for them either.
    const unfinished =
      stopReason === StopReason.Error || stopReason === StopReason.Aborted;
    const starts = unfinished
      ? []
      : assistant.content.flatMap((part) =>
          part.type === "toolCall"
            ? [
                toolStartEvent(
                  {
                    toolCallId: part.id,
                    toolName: part.name,
                    args: part.arguments,
                  },
                  policy
                ),
              ]
            : []
        );
    const persisted = await transcript.append(
      { id: open.id, message: assistant },
      [assistantEndEvent(open.id, assistant), ...starts]
    );
    if (persisted && usage) {
      await context.onUsage?.({
        source: AgentUsageSource.Turn,
        providerId: assistant.provider,
        modelId: assistant.model,
        usage: assistant.usage,
        entryId: open.id,
      });
    }
  };

  const handleChunk = async (chunk: StreamChunk): Promise<void> => {
    if (transcript.failed) return;
    // A call re-run on resume was streamed by an earlier reply, but its result still needs a name.
    if (chunk.type === "TOOL_CALL_START") {
      calls.names.set(chunk.toolCallId, chunk.toolCallName);
    }
    const delta = reply?.apply(chunk);
    if (delta) onEvent(delta);
    switch (chunk.type) {
      case "RUN_FINISHED": {
        await persistReply(
          stopReasonOf(
            chunk.finishReason ?? chunk.metadata?.tanstack?.finishReason
          ),
          tokenUsageOf(chunk)
        );
        if (chunk.outcome?.type === "interrupt") {
          interrupted = chunk.outcome.interrupts.flatMap((entry) =>
            entry.toolCallId ? [entry.toolCallId] : []
          );
        }
        finished = true;
        return;
      }
      case "RUN_ERROR": {
        providerError =
          chunk.message ?? chunk.error?.message ?? "The provider failed.";
        await persistReply(
          StopReason.Error,
          tokenUsageOf(chunk),
          providerError
        );
        return;
      }
      case "TOOL_CALL_RESULT": {
        const result = toolResultMessageOf(chunk, {
          toolName: calls.names.get(chunk.toolCallId) ?? "unknown",
          refusal: calls.refused.get(chunk.toolCallId),
          declined: calls.declined.get(chunk.toolCallId),
          details: context.tools.detailsOf(chunk.toolCallId),
        });
        await transcript.append({ id: randomUUID(), message: result }, [
          toolEndEvent(result, policy),
        ]);
        return;
      }
      default:
        return;
    }
  };

  const middleware: ChatMiddleware = {
    name: "agent-turn",
    onIteration: () => {
      reply = startReply(binding);
      onEvent({ type: "assistant:start", messageId: reply.id });
    },
    onConfig: async (ctx, config) => {
      if (ctx.phase !== "beforeModel" || !volatileContext) return config;
      try {
        const text = await volatileContext();
        if (!text) return config;
        // Provider-only: the engine's history, and so the transcript, never carries it.
        return {
          ...config,
          providerMessages: [
            ...(config.providerMessages ?? config.messages),
            { role: "user", content: text },
          ],
        };
      } catch (error) {
        // Fail closed: a model that cannot see the current state must not act on it.
        control.fail(errorOfThrown(error), error);
        return config;
      }
    },
    onChunk: async (_ctx, chunk) => {
      await handleChunk(chunk);
    },
    onBeforeToolCall: async (_ctx, call) => {
      if (calls.checked.has(call.toolCallId)) return undefined;
      try {
        const refusal = await context.check({
          toolCallId: call.toolCallId,
          toolName: call.toolName,
          input: call.args,
        });
        if (!refusal) return undefined;
        calls.refused.set(call.toolCallId, refusal.reason);
        return { type: "skip", result: refusal.reason };
      } catch (error) {
        control.fail(errorOfThrown(error), error);
        calls.refused.set(call.toolCallId, "This turn is being stopped.");
        return { type: "skip", result: "This turn is being stopped." };
      }
    },
    onAfterToolCall: (_ctx, info) => {
      const scope = policy.toolInfo(info.toolName).changes;
      if (!info.ok || !scope || calls.refused.has(info.toolCallId)) return;
      calls.stateRevision += 1;
      onEvent({ type: "state:changed", scope, revision: calls.stateRevision });
    },
  };

  try {
    const stream = chat({
      adapter: binding.adapter,
      messages: request.messages,
      systemPrompts: [context.systemPrompt],
      tools: context.tools.engineTools,
      modelOptions: binding.modelOptions,
      abortController: control.controller,
      // The engine's default stops after five model calls. A turn is bounded by its own budget
      // and deadline, and ends when the model stops calling tools.
      agentLoopStrategy: () => true,
      threadId: context.sessionId,
      runId: request.runId,
      ...(request.parentRunId !== undefined && {
        parentRunId: request.parentRunId,
      }),
      ...(request.resume && { resume: request.resume }),
      middleware: [modelSpans(binding), middleware],
    });
    for await (const _chunk of stream) {
      // Every chunk is handled, persisted and announced by the middleware before it arrives.
    }
  } catch (error) {
    const failure = control.failure;
    if (failure) {
      await persistReply(StopReason.Aborted, undefined);
      return { status: "error", failure };
    }
    if (
      control.controller.signal.aborted &&
      (control.aborted || isAbortError(error))
    ) {
      await persistReply(StopReason.Aborted, undefined);
      return { status: "aborted" };
    }
    const detail = errorOfThrown(error).message;
    await persistReply(StopReason.Error, undefined, detail);
    return {
      status: "error",
      failure: { error: errorOfProviderMessage(detail), cause: error },
    };
  }

  // A reply still open ended with its run: the controller fired mid-generation, for an abort or
  // a host failure, whose kind the live turn reports and replay does not.
  if (reply) await persistReply(StopReason.Aborted, undefined);
  const failure = control.failure;
  if (failure) return { status: "error", failure };
  if (control.aborted) return { status: "aborted" };
  if (providerError !== undefined) {
    return {
      status: "error",
      failure: { error: errorOfProviderMessage(providerError) },
    };
  }
  if (interrupted && interrupted.length > 0) {
    return { status: "interrupted", toolCallIds: interrupted };
  }
  if (!finished) {
    return {
      status: "error",
      failure: {
        error: {
          kind: AgentErrorKind.Internal,
          message: "The turn ended without the model finishing.",
        },
      },
    };
  }
  return { status: "done" };
};
