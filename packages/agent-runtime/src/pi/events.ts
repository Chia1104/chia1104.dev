import type { AgentHarnessEvent } from "@earendil-works/pi-agent-core";

import type { AgentEventPresentation } from "../types.ts";
import { clipDetails } from "../wire/clip.ts";
import type { AgentWireEvent } from "../wire/schema.ts";

// ============================================
// pi event → wire event
// ============================================

/**
 * pi's assistant messages carry no id, so the mapper combines a caller-owned turn id with a
 * per-turn sequence and accumulates text/thinking to emit a single terminal `assistant:end`.
 */
export interface PiWireEventMapperOptions extends AgentEventPresentation {
  /** Stable, unique identifier for the turn that owns these live events. */
  messageIdPrefix: string;
}

export const createPiWireEventMapper = (options: PiWireEventMapperOptions) => {
  let assistantSeq = 0;
  let current: { id: string; text: string; thinking: string } | undefined;

  return (event: AgentHarnessEvent): AgentWireEvent[] => {
    switch (event.type) {
      case "message_start": {
        if (event.message.role !== "assistant") return [];
        assistantSeq += 1;
        current = {
          id: `a:${options.messageIdPrefix}:${assistantSeq}`,
          text: "",
          thinking: "",
        };
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
              (event.result as { details?: unknown } | undefined)?.details
            ),
          },
        ];

      case "session_compact":
        return [
          {
            type: "session:compacted",
            summary: event.compactionEntry.summary,
            tokensBefore: event.compactionEntry.tokensBefore,
          },
        ];

      default:
        return [];
    }
  };
};
