import { EventType } from "@tanstack/ai";
import * as z from "zod";

import { describeAgentError } from "../wire/fold.ts";
import type { AgentWireEvent } from "../wire/schema.ts";

const runStartedSchema = z.object({
  type: z.literal(EventType.RUN_STARTED),
  threadId: z.string(),
  runId: z.string(),
});

const runFinishedSchema = z.object({
  type: z.literal(EventType.RUN_FINISHED),
  threadId: z.string(),
  runId: z.string(),
  finishReason: z
    .enum(["stop", "length", "content_filter", "tool_calls"])
    .nullable()
    .optional(),
  result: z.unknown().optional(),
});

const runErrorSchema = z.object({
  type: z.literal(EventType.RUN_ERROR),
  runId: z.string().optional(),
  message: z.string(),
  code: z.string().optional(),
});

const textMessageStartSchema = z.object({
  type: z.literal(EventType.TEXT_MESSAGE_START),
  messageId: z.string(),
  role: z.literal("assistant"),
});

const textMessageContentSchema = z.object({
  type: z.literal(EventType.TEXT_MESSAGE_CONTENT),
  messageId: z.string(),
  delta: z.string(),
});

const textMessageEndSchema = z.object({
  type: z.literal(EventType.TEXT_MESSAGE_END),
  messageId: z.string(),
});

const reasoningStartSchema = z.object({
  type: z.literal(EventType.REASONING_START),
  messageId: z.string(),
});

const reasoningMessageStartSchema = z.object({
  type: z.literal(EventType.REASONING_MESSAGE_START),
  messageId: z.string(),
  role: z.literal("reasoning"),
});

const reasoningMessageContentSchema = z.object({
  type: z.literal(EventType.REASONING_MESSAGE_CONTENT),
  messageId: z.string(),
  delta: z.string(),
});

const reasoningMessageEndSchema = z.object({
  type: z.literal(EventType.REASONING_MESSAGE_END),
  messageId: z.string(),
});

const reasoningEndSchema = z.object({
  type: z.literal(EventType.REASONING_END),
  messageId: z.string(),
});

const toolCallStartSchema = z.object({
  type: z.literal(EventType.TOOL_CALL_START),
  toolCallId: z.string(),
  toolCallName: z.string(),
  toolName: z.string(),
  parentMessageId: z.string().optional(),
});

const toolCallArgsSchema = z.object({
  type: z.literal(EventType.TOOL_CALL_ARGS),
  toolCallId: z.string(),
  delta: z.string(),
});

const toolCallEndSchema = z.object({
  type: z.literal(EventType.TOOL_CALL_END),
  toolCallId: z.string(),
  toolCallName: z.string().optional(),
  toolName: z.string().optional(),
  input: z.unknown().optional(),
});

const toolCallResultSchema = z.object({
  type: z.literal(EventType.TOOL_CALL_RESULT),
  messageId: z.string(),
  toolCallId: z.string(),
  content: z.string(),
  role: z.literal("tool").optional(),
  state: z.enum(["output-available", "output-error"]).optional(),
});

const customSchema = z.object({
  type: z.literal(EventType.CUSTOM),
  name: z.string(),
  value: z.unknown().optional(),
});

/** The AG-UI subset emitted by the TanStack AI transport. */
export const tanstackAgentEventSchema = z.discriminatedUnion("type", [
  runStartedSchema,
  runFinishedSchema,
  runErrorSchema,
  textMessageStartSchema,
  textMessageContentSchema,
  textMessageEndSchema,
  reasoningStartSchema,
  reasoningMessageStartSchema,
  reasoningMessageContentSchema,
  reasoningMessageEndSchema,
  reasoningEndSchema,
  toolCallStartSchema,
  toolCallArgsSchema,
  toolCallEndSchema,
  toolCallResultSchema,
  customSchema,
]);

export type TanStackAgentEvent = z.infer<typeof tanstackAgentEventSchema>;

export interface TanStackAgentStreamOptions {
  threadId: string;
  runId: string;
}

interface AssistantState {
  id: string;
  text: string;
  thinking: string;
  reasoningStarted: boolean;
  ended: boolean;
}

interface ToolState {
  id: string;
  name: string;
  pendingApproval: boolean;
}

const jsonOf = <TValue>(value: TValue): string => {
  try {
    return JSON.stringify(value) ?? "null";
  } catch {
    return JSON.stringify(String(value));
  }
};

const missingSuffix = (complete: string, streamed: string): string =>
  complete.startsWith(streamed) ? complete.slice(streamed.length) : complete;

/**
 * Adapts the internal, harness-neutral event protocol to TanStack AI's AG-UI protocol.
 *
 * IDs are scoped to the client run because a durable workflow contains many turns and the harness
 * restarts its per-turn message sequence at `a1`. Tool approvals retain the original tool-call id
 * as their approval id so the continuation can be routed back to the persisted decision.
 */
export const createTanStackAgentEventMapper = ({
  runId,
}: TanStackAgentStreamOptions) => {
  const assistants = new Map<string, AssistantState>();
  const tools = new Map<string, ToolState>();
  let activeAssistantId: string | undefined;

  const scopedId = (id: string) => `${runId}:${id}`;

  const mapper = (event: AgentWireEvent): TanStackAgentEvent[] => {
    switch (event.type) {
      case "run:start":
      case "user":
        return [];

      case "assistant:start": {
        const assistant = {
          id: scopedId(event.messageId),
          text: "",
          thinking: "",
          reasoningStarted: false,
          ended: false,
        };
        assistants.set(event.messageId, assistant);
        activeAssistantId = assistant.id;
        return [
          {
            type: EventType.TEXT_MESSAGE_START,
            messageId: assistant.id,
            role: "assistant",
          },
        ];
      }

      case "assistant:delta": {
        const assistant = assistants.get(event.messageId);
        if (!assistant || assistant.ended) return [];

        if (event.channel === "text") {
          assistant.text += event.delta;
          return [
            {
              type: EventType.TEXT_MESSAGE_CONTENT,
              messageId: assistant.id,
              delta: event.delta,
            },
          ];
        }

        assistant.thinking += event.delta;
        const chunks: TanStackAgentEvent[] = [];
        if (!assistant.reasoningStarted) {
          assistant.reasoningStarted = true;
          chunks.push(
            {
              type: EventType.REASONING_START,
              messageId: assistant.id,
            },
            {
              type: EventType.REASONING_MESSAGE_START,
              messageId: assistant.id,
              role: "reasoning",
            }
          );
        }
        chunks.push({
          type: EventType.REASONING_MESSAGE_CONTENT,
          messageId: assistant.id,
          delta: event.delta,
        });
        return chunks;
      }

      case "assistant:end": {
        const assistant = assistants.get(event.messageId) ?? {
          id: scopedId(event.messageId),
          text: "",
          thinking: "",
          reasoningStarted: false,
          ended: false,
        };
        assistants.set(event.messageId, assistant);
        assistant.ended = true;

        const chunks: TanStackAgentEvent[] = [];
        const thinkingSuffix = missingSuffix(
          event.thinking ?? "",
          assistant.thinking
        );
        if ((event.thinking || thinkingSuffix) && !assistant.reasoningStarted) {
          assistant.reasoningStarted = true;
          chunks.push(
            {
              type: EventType.REASONING_START,
              messageId: assistant.id,
            },
            {
              type: EventType.REASONING_MESSAGE_START,
              messageId: assistant.id,
              role: "reasoning",
            }
          );
        }
        if (thinkingSuffix) {
          chunks.push({
            type: EventType.REASONING_MESSAGE_CONTENT,
            messageId: assistant.id,
            delta: thinkingSuffix,
          });
        }
        if (assistant.reasoningStarted) {
          chunks.push(
            {
              type: EventType.REASONING_MESSAGE_END,
              messageId: assistant.id,
            },
            {
              type: EventType.REASONING_END,
              messageId: assistant.id,
            }
          );
        }

        const textSuffix = missingSuffix(event.text, assistant.text);
        if (textSuffix) {
          chunks.push({
            type: EventType.TEXT_MESSAGE_CONTENT,
            messageId: assistant.id,
            delta: textSuffix,
          });
        }
        chunks.push({
          type: EventType.TEXT_MESSAGE_END,
          messageId: assistant.id,
        });
        return chunks;
      }

      case "tool:start": {
        const tool = {
          id: scopedId(event.toolCallId),
          name: event.toolName,
          pendingApproval: false,
        };
        tools.set(event.toolCallId, tool);
        return [
          activeAssistantId
            ? {
                type: EventType.TOOL_CALL_START,
                toolCallId: tool.id,
                toolCallName: tool.name,
                toolName: tool.name,
                parentMessageId: activeAssistantId,
              }
            : {
                type: EventType.TOOL_CALL_START,
                toolCallId: tool.id,
                toolCallName: tool.name,
                toolName: tool.name,
              },
          {
            type: EventType.TOOL_CALL_ARGS,
            toolCallId: tool.id,
            delta: jsonOf(event.args),
          },
          {
            type: EventType.TOOL_CALL_END,
            toolCallId: tool.id,
            toolCallName: tool.name,
            toolName: tool.name,
            input: event.args,
          },
        ];
      }

      case "tool:update": {
        const tool = tools.get(event.toolCallId);
        return [
          {
            type: EventType.CUSTOM,
            name: "chia.agent.tool-update",
            value: {
              toolCallId: tool?.id ?? scopedId(event.toolCallId),
              summary: event.summary,
            },
          },
        ];
      }

      case "tool:end": {
        const tool = tools.get(event.toolCallId) ?? {
          id: scopedId(event.toolCallId),
          name: event.toolName,
          pendingApproval: false,
        };
        tools.set(event.toolCallId, tool);

        // The permission gate deliberately reports its refusal as a failed tool execution. Once an
        // approval request has been emitted, surfacing that refusal as TOOL_CALL_RESULT would
        // overwrite TanStack's `approval-requested` state with an error.
        if (tool.pendingApproval) return [];

        return [
          {
            type: EventType.TOOL_CALL_RESULT,
            messageId: `${tool.id}:result`,
            toolCallId: tool.id,
            role: "tool",
            content: jsonOf({
              summary: event.summary,
              details: event.details,
            }),
            state: event.isError ? "output-error" : "output-available",
          },
        ];
      }

      case "approval:request": {
        const tool = tools.get(event.toolCallId) ?? {
          id: scopedId(event.toolCallId),
          name: event.toolName,
          pendingApproval: false,
        };
        tool.pendingApproval = true;
        tools.set(event.toolCallId, tool);
        return [
          {
            type: EventType.CUSTOM,
            name: "approval-requested",
            value: {
              toolCallId: tool.id,
              toolName: event.toolName,
              input: event.args,
              approval: {
                id: event.toolCallId,
                needsApproval: true,
              },
            },
          },
        ];
      }

      case "approval:resolved": {
        return [
          {
            type: EventType.CUSTOM,
            name: "chia.agent.approval-resolved",
            value: {
              toolCallId: scopedId(event.toolCallId),
              approvalId: event.toolCallId,
              approved: event.approved,
              comment: event.comment,
            },
          },
        ];
      }

      case "session:compacted":
        return [
          {
            type: EventType.CUSTOM,
            name: "chia.agent.session-compacted",
            value: {
              summary: event.summary,
              tokensBefore: event.tokensBefore,
            },
          },
        ];

      case "state:changed":
        return [
          {
            type: EventType.CUSTOM,
            name: "chia.agent.state-changed",
            value: {
              scope: event.scope,
              revision: event.revision,
            },
          },
        ];

      case "error":
        return [
          {
            type: EventType.RUN_ERROR,
            runId,
            // TanStack's client keeps only `message`, so the headline rides in it.
            message: describeAgentError(event),
            code: event.kind,
          },
        ];

      case "run:end":
        return [
          {
            type: EventType.RUN_FINISHED,
            threadId: "",
            runId,
            finishReason: "stop",
            result: { reason: event.reason },
          },
        ];
    }
  };

  return mapper;
};

/**
 * Starts one TanStack client run, replays/tails the matching durable workflow turn, and terminates
 * at that turn's `run:end` while leaving the underlying multi-turn workflow alive.
 */
export const toTanStackAgentEventStream = async function* (
  events: AsyncIterable<AgentWireEvent>,
  options: TanStackAgentStreamOptions
): AsyncGenerator<TanStackAgentEvent, void, void> {
  yield {
    type: EventType.RUN_STARTED,
    threadId: options.threadId,
    runId: options.runId,
  };

  const mapEvent = createTanStackAgentEventMapper(options);
  for await (const event of events) {
    for (const chunk of mapEvent(event)) {
      if (chunk.type === EventType.RUN_FINISHED) {
        yield { ...chunk, threadId: options.threadId };
      } else {
        yield chunk;
      }
    }
    if (event.type === "error" || event.type === "run:end") return;
  }
};
