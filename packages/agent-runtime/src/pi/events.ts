import type { AgentEvent } from "@earendil-works/pi-agent-core";

import type { AgentEventPresentation } from "../types.ts";
import { clipDetails } from "../wire/clip.ts";
import type { AgentWireEvent } from "../wire/schema.ts";

/**
 * pi's assistant messages carry no id, so the mapper asks the turn for the entry id it will
 * persist the message under and accumulates text/thinking to emit a single terminal
 * `assistant:end` with that same id. The replayed transcript then names the message
 * identically.
 */
export interface PiWireEventMapperOptions extends AgentEventPresentation {
  /** The entry id the turn has reserved for the message that just started. */
  messageIdOf: () => string;
}

export const createPiWireEventMapper = (options: PiWireEventMapperOptions) => {
  let current: { id: string; text: string; thinking: string } | undefined;

  return (event: AgentEvent): AgentWireEvent[] => {
    switch (event.type) {
      case "message_start": {
        if (event.message.role !== "assistant") return [];
        current = { id: options.messageIdOf(), text: "", thinking: "" };
        return [{ type: "assistant:start", messageId: current.id }];
      }

      case "message_update": {
        if (!current) return [];
        const inner = event.assistantMessageEvent;
        if (inner.type === "text_delta") {
          current.text += inner.delta;
          return [
            {
              type: "assistant:delta",
              messageId: current.id,
              channel: "text",
              delta: inner.delta,
            },
          ];
        }
        if (inner.type === "thinking_delta") {
          current.thinking += inner.delta;
          return [
            {
              type: "assistant:delta",
              messageId: current.id,
              channel: "thinking",
              delta: inner.delta,
            },
          ];
        }
        return [];
      }

      case "message_end": {
        if (event.message.role !== "assistant" || !current) return [];
        const message = event.message;
        const done = current;
        current = undefined;
        return [
          {
            type: "assistant:end",
            messageId: done.id,
            text: done.text,
            thinking: done.thinking || undefined,
            stopReason: message.stopReason,
            at: message.timestamp,
            usage: message.usage
              ? {
                  input: message.usage.input,
                  output: message.usage.output,
                  cacheRead: message.usage.cacheRead,
                  cacheWrite: message.usage.cacheWrite,
                  costTotal: message.usage.cost?.total,
                }
              : undefined,
          },
        ];
      }

      case "tool_execution_start":
        return [
          {
            type: "tool:start",
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            label: options.labelOf(event.toolName),
            tier: options.tierOf(event.toolName),
            args: event.args,
          },
        ];

      case "tool_execution_update":
        return [
          {
            type: "tool:update",
            toolCallId: event.toolCallId,
            summary: options.summarize(
              event.toolName,
              event.partialResult,
              false
            ),
          },
        ];

      case "tool_execution_end":
        return [
          {
            type: "tool:end",
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            isError: event.isError,
            summary: options.summarize(
              event.toolName,
              event.result,
              event.isError
            ),
            details: clipDetails(
              /* SAFETY: The producer contract guarantees this value satisfies { details?: unknown } | undefined. */ (
                event.result as { details?: unknown } | undefined
              )?.details
            ),
          },
        ];

      default:
        return [];
    }
  };
};
