import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type {
  Api,
  AssistantMessage,
  AssistantMessageEventStream,
  Model,
  Models,
} from "@earendil-works/pi-ai";
import { context, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import type { Span } from "@opentelemetry/api";

import type { AgentTurnError } from "./types.ts";

/**
 * OpenTelemetry GenAI semantic convention keys, copied rather than imported: the package marks
 * them incubating.
 */
const GenAI = {
  operation: "gen_ai.operation.name",
  provider: "gen_ai.provider.name",
  conversationId: "gen_ai.conversation.id",
  requestModel: "gen_ai.request.model",
  responseModel: "gen_ai.response.model",
  responseId: "gen_ai.response.id",
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

const endModelSpan = (
  span: Span,
  message: AssistantMessage,
  timeToFirstChunkMs: number | undefined
) => {
  span.setAttributes({
    [GenAI.responseModel]: message.responseModel ?? message.model,
    [GenAI.responseId]: message.responseId,
    [GenAI.finishReasons]: [message.stopReason],
    [GenAI.timeToFirstChunk]:
      timeToFirstChunkMs === undefined ? undefined : timeToFirstChunkMs / 1000,
    [GenAI.inputTokens]: message.usage.input,
    [GenAI.outputTokens]: message.usage.output,
    [GenAI.cacheReadTokens]: message.usage.cacheRead,
    [GenAI.cacheCreationTokens]: message.usage.cacheWrite,
    [GenAI.reasoningTokens]: message.usage.reasoning,
    "gen_ai.usage.cost": message.usage.cost.total,
  });
  // The provider's error text stays out of the span; the turn logs it with its kind.
  if (message.stopReason === "error") {
    span.setStatus({ code: SpanStatusCode.ERROR });
  }
  span.end();
};

/** Pi reports a setup failure as an error message rather than a throw; so does this. */
const errorMessageOf = (
  model: Model<Api>,
  cause: unknown
): AssistantMessage => ({
  role: "assistant",
  content: [],
  api: model.api,
  provider: model.provider,
  model: model.id,
  usage: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
  stopReason: "error",
  errorMessage: cause instanceof Error ? cause.message : String(cause),
  timestamp: Date.now(),
});

/**
 * Wraps one provider request in a `chat` client span that stays open until the stream settles,
 * so the HTTP spans beneath it and the usage it reports belong to that request.
 */
export const traceModelStream = (
  model: Model<Api>,
  open: () => AssistantMessageEventStream
): AssistantMessageEventStream => {
  const span = tracer.startSpan(`chat ${model.id}`, {
    kind: SpanKind.CLIENT,
    attributes: {
      [GenAI.operation]: "chat",
      [GenAI.provider]: model.provider,
      [GenAI.requestModel]: model.id,
      "pi.ai.api": model.api,
    },
  });
  const spanContext = trace.setSpan(context.active(), span);
  const startedAt = performance.now();
  const source = context.with(spanContext, open);
  const target = createAssistantMessageEventStream();

  const forward = async () => {
    let firstChunkAt: number | undefined;
    try {
      for await (const event of source) {
        if (firstChunkAt === undefined && event.type !== "start") {
          firstChunkAt = performance.now();
        }
        target.push(event);
      }
      const message = await source.result();
      endModelSpan(
        span,
        message,
        firstChunkAt === undefined ? undefined : firstChunkAt - startedAt
      );
      target.end(message);
    } catch (cause) {
      failSpan(span, cause);
      span.end();
      const message = errorMessageOf(model, cause);
      target.push({ type: "error", reason: "error", error: message });
      target.end(message);
    }
  };
  void context.with(spanContext, forward);

  return target;
};

/**
 * Records every provider request made through `models`, completions included, which Pi routes
 * through `streamSimple`.
 */
export const withModelSpans = (models: Models): Models => {
  const streamSimple = models.streamSimple.bind(models);
  models.streamSimple = (model, llmContext, options) =>
    traceModelStream(model, () => streamSimple(model, llmContext, options));
  return models;
};

export interface AgentTurnSpan {
  sessionId: string;
  runId?: string;
  model: Model<Api>;
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
        [GenAI.provider]: turn.model.provider,
        [GenAI.requestModel]: turn.model.id,
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

/** Wraps one tool execution in an `execute_tool` span. */
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
