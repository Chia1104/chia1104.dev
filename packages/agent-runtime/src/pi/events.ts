import type { AgentEvent } from "@earendil-works/pi-agent-core";

import type { AgentEventPresentation } from "../types.ts";
import {
  assistantEndEvent,
  toolEndEvent,
  toolStartEvent,
} from "../wire/replay.ts";
import type { AgentWireEvent } from "../wire/schema.ts";

/**
 * pi's assistant messages carry no id, so the mapper asks the turn for the entry id it will
 * persist the message under and ends the message with that same id. The replayed transcript
 * then names the message identically; the terminal events are projected by the replay's own
 * functions, from the finished message.
 */
export interface PiWireEventMapperOptions extends AgentEventPresentation {
  /** The entry id the turn has reserved for the message that just started. */
  messageIdOf: () => string;
}

export const createPiWireEventMapper = (options: PiWireEventMapperOptions) => {
  let messageId: string | undefined;

  return (event: AgentEvent): AgentWireEvent[] => {
    switch (event.type) {
      case "message_start": {
        if (event.message.role !== "assistant") return [];
        messageId = options.messageIdOf();
        return [{ type: "assistant:start", messageId }];
      }

      case "message_update": {
        if (!messageId) return [];
        const inner = event.assistantMessageEvent;
        if (inner.type !== "text_delta" && inner.type !== "thinking_delta") {
          return [];
        }
        return [
          {
            type: "assistant:delta",
            messageId,
            channel: inner.type === "text_delta" ? "text" : "thinking",
            delta: inner.delta,
          },
        ];
      }

      case "message_end": {
        if (event.message.role !== "assistant" || !messageId) return [];
        const ended = messageId;
        messageId = undefined;
        return [assistantEndEvent(ended, event.message)];
      }

      case "tool_execution_start":
        return [
          toolStartEvent(
            {
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              args: event.args,
            },
            options
          ),
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
          toolEndEvent(
            {
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              isError: event.isError,
              result: event.result,
            },
            options
          ),
        ];

      default:
        return [];
    }
  };
};
