import { SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import type { Span } from "@opentelemetry/api";
import type { ChatMiddleware } from "@tanstack/ai";

import type { AgentModelBinding, AgentModelRef } from "./models.ts";
import { tokenUsageOf, usageOf } from "./models.ts";
import type { AgentTurnError } from "./types.ts";

/**
 * GenAI spans for agent work: `invoke_agent` per turn, and beneath it a `chat` span per provider
 * request and an `execute_tool` span per tool call. Spans carry identifiers, models, usage and
 * outcome, never prompts, outputs, tool arguments or error text, so the engine's own span
 * middleware, which records error messages, is not used.
 */

/**
 * OpenTelemetry GenAI semantic convention keys, copied rather than imported: the package marks
 * them incubating.
 */
const GenAI = {
  operation: "gen_ai.operation.name",
  provider: "gen_ai.provider.name",
  conversationId: "gen_ai.conversation.id",
  requestModel: "gen_ai.request.model",
  finishReasons: "gen_ai.response.finish_reasons",
  timeToFirstChunk: "gen_ai.response.time_to_first_chunk",
  inputTokens: "gen_ai.usage.input_tokens",
  outputTokens: "gen_ai.usage.output_tokens",
  cacheReadTokens: "gen_ai.usage.cache_read.input_tokens",
  cacheCreationTokens: "gen_ai.usage.cache_creation.input_tokens",
  reasoningTokens: "gen_ai.usage.reasoning.output_tokens",
  toolName: "gen_ai.tool.name",
  toolCallId: "gen_ai.tool.call.id",
} as const;

const tracer = trace.getTracer("@chia/agent-runtime");

/**
 * Marks a span failed with the error's class only. A provider or tool message can carry the
 * operator's content, so the message and stack stay in the log, not in exported spans.
 */
const failSpan = (span: Span, cause: unknown) => {
  span.setAttribute(
    "error.type",
    cause instanceof Error ? cause.name : "unknown"
  );
  span.setStatus({ code: SpanStatusCode.ERROR });
};

/**
 * A `chat` client span for each provider request of one engine run, under the active span.
 * Input tokens are the whole prompt, cache included, whichever way the adapter counts them.
 */
export const modelSpans = (
  binding: Pick<AgentModelBinding, "model" | "promptTokensIncludeCache">
): ChatMiddleware => {
  let span: Span | undefined;
  let startedAt = 0;
  let firstChunkAt: number | undefined;

  const end = () => {
    span?.end();
    span = undefined;
  };

  return {
    name: "model-spans",
    onIteration: () => {
      end();
      span = tracer.startSpan(`chat ${binding.model.modelId}`, {
        kind: SpanKind.CLIENT,
        attributes: {
          [GenAI.operation]: "chat",
          [GenAI.provider]: binding.model.providerId,
          [GenAI.requestModel]: binding.model.modelId,
        },
      });
      startedAt = performance.now();
      firstChunkAt = undefined;
    },
    onChunk: (_ctx, chunk) => {
      if (!span) return;
      if (
        firstChunkAt === undefined &&
        (chunk.type === "TEXT_MESSAGE_CONTENT" ||
          chunk.type === "REASONING_MESSAGE_CONTENT" ||
          chunk.type === "TOOL_CALL_START")
      ) {
        firstChunkAt = performance.now();
      }
      if (chunk.type === "RUN_FINISHED") {
        const reported = tokenUsageOf(chunk);
        const usage = reported ? usageOf(binding, reported) : undefined;
        span.setAttributes({
          [GenAI.finishReasons]: [
            chunk.finishReason ??
              chunk.metadata?.tanstack?.finishReason ??
              "stop",
          ],
          [GenAI.timeToFirstChunk]:
            firstChunkAt === undefined
              ? undefined
              : (firstChunkAt - startedAt) / 1000,
          ...(usage && {
            [GenAI.inputTokens]:
              usage.input + usage.cacheRead + usage.cacheWrite,
            [GenAI.outputTokens]: usage.output,
            [GenAI.cacheReadTokens]: usage.cacheRead,
            [GenAI.cacheCreationTokens]: usage.cacheWrite,
            [GenAI.reasoningTokens]: usage.reasoning,
            "gen_ai.usage.cost": usage.cost.total,
          }),
        });
        end();
      } else if (chunk.type === "RUN_ERROR") {
        span.setAttribute("error.type", "provider_error");
        span.setStatus({ code: SpanStatusCode.ERROR });
        end();
      }
    },
    onAbort: () => {
      span?.setAttribute(GenAI.finishReasons, ["aborted"]);
      end();
    },
    onError: (_ctx, info) => {
      if (span) failSpan(span, info.error);
      end();
    },
    onFinish: end,
  };
};

export interface AgentTurnSpan {
  sessionId: string;
  runId?: string;
  model: AgentModelRef;
}

/** Wraps one agent turn in an `invoke_agent` span; model and tool spans nest under it. */
export const traceAgentTurn = <
  TExecution extends { status: string; error?: AgentTurnError },
>(
  turn: AgentTurnSpan,
  run: () => Promise<TExecution>
): Promise<TExecution> =>
  tracer.startActiveSpan(
    "invoke_agent",
    {
      attributes: {
        [GenAI.operation]: "invoke_agent",
        [GenAI.conversationId]: turn.sessionId,
        "agent.run_id": turn.runId,
        [GenAI.provider]: turn.model.providerId,
        [GenAI.requestModel]: turn.model.modelId,
      },
    },
    async (span) => {
      try {
        const execution = await run();
        span.setAttributes({
          "agent.turn.status": execution.status,
          "error.type": execution.error?.kind,
        });
        if (execution.status === "error") {
          span.setStatus({ code: SpanStatusCode.ERROR });
        }
        return execution;
      } catch (cause) {
        failSpan(span, cause);
        throw cause;
      } finally {
        span.end();
      }
    }
  );

/** Wraps one tool execution in an `execute_tool` span, active while the tool runs. */
export const traceToolCall = <TResult>(
  toolName: string,
  toolCallId: string,
  run: () => Promise<TResult>
): Promise<TResult> =>
  tracer.startActiveSpan(
    `execute_tool ${toolName}`,
    {
      attributes: {
        [GenAI.operation]: "execute_tool",
        [GenAI.toolName]: toolName,
        [GenAI.toolCallId]: toolCallId,
      },
    },
    async (span) => {
      try {
        return await run();
      } catch (cause) {
        failSpan(span, cause);
        throw cause;
      } finally {
        span.end();
      }
    }
  );
