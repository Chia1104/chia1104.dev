import * as z from "zod";

import { errorOfAssistantMessage } from "../pi/errors.ts";
import type { SessionEntry } from "../session/entries.ts";
import type { AgentEventPresentation } from "../types.ts";

import { clipDetails } from "./clip.ts";
import { isOperatorDecisionText } from "./operator-decision.ts";
import type { AgentWireEvent } from "./schema.ts";

/**
 * Rebuilds wire events from a persisted branch so a reconnecting client renders through the
 * same fold as the live stream. Deltas are not replayed: a completed message arrives as a
 * single `assistant:end`.
 *
 * A message's wire id is its entry id, live and replayed alike, so a client can name the entry
 * behind any message it shows (rewind and fork targets).
 *
 * Pi appends a call's result right after the assistant message that issued it, so a call whose
 * result is not the next thing on the branch never got one. Those are closed as `aborted` here:
 * a `tool:start` with no end would read as still running forever.
 */
export const entriesToWireEvents = (
  entries: readonly SessionEntry[],
  options: AgentEventPresentation
): AgentWireEvent[] => {
  const events: AgentWireEvent[] = [];
  /** Calls from the last assistant message whose results have not arrived yet. */
  let open = new Map<string, string>();
  const closeOpen = () => {
    for (const [toolCallId, toolName] of open) {
      events.push({
        type: "tool:end",
        toolCallId,
        toolName,
        isError: false,
        aborted: true,
        summary: "",
      });
    }
    open = new Map();
  };

  for (const entry of entries) {
    if (entry.type !== "message" || entry.message.role !== "toolResult") {
      closeOpen();
    }
    if (entry.type === "compaction") {
      events.push({
        type: "session:compacted",
        summary: entry.summary,
        tokensBefore: entry.tokensBefore,
      });
      continue;
    }
    if (entry.type === "branch_summary") {
      events.push({ type: "session:rewound", summary: entry.summary });
      continue;
    }
    if (entry.type !== "message") continue;
    const message = entry.message;

    if (message.role === "user") {
      const text = contentToText(message.content);
      events.push({
        type: "user",
        messageId: entry.id,
        text,
        at: message.timestamp,
        origin: isOperatorDecisionText(text) ? "operator-decision" : undefined,
      });
      continue;
    }

    if (message.role === "assistant") {
      const messageId = entry.id;
      const text = message.content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("");
      const thinking = message.content
        .filter((part) => part.type === "thinking")
        .map((part) => part.thinking)
        .join("");

      events.push({
        type: "assistant:end",
        messageId,
        text,
        thinking: thinking || undefined,
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
      });
      // The live turn emits `error` beside a failed assistant message; replay must too, or the
      // notice vanishes on reload.
      if (message.stopReason === "error") {
        events.push({
          type: "error",
          kind: errorOfAssistantMessage(message).kind,
        });
      }
      // Pi never executes the calls of a message that ended in `error` or `aborted`, and the
      // live turn showed no card for them. Replay matches, or a stop mid-generation grows cards
      // on reload.
      if (message.stopReason === "error" || message.stopReason === "aborted") {
        continue;
      }

      for (const part of message.content) {
        if (part.type !== "toolCall") continue;
        open.set(part.id, part.name);
        events.push({
          type: "tool:start",
          toolCallId: part.id,
          toolName: part.name,
          label: options.labelOf(part.name),
          tier: options.tierOf(part.name),
          args: part.arguments,
        });
      }
      continue;
    }

    if (message.role === "toolResult") {
      open.delete(message.toolCallId);
      events.push({
        type: "tool:end",
        toolCallId: message.toolCallId,
        toolName: message.toolName,
        isError: message.isError,
        summary: options.summarize(message.toolName, message, message.isError),
        details: clipDetails(message.details),
      });
    }
  }
  closeOpen();

  return events;
};

const contentToText = (
  content: string | readonly { type: string; text?: string }[]
): string => {
  const text = z.string().safeParse(content).data;
  if (text !== undefined) return text;
  return z
    .array(z.object({ type: z.string(), text: z.string().optional() }))
    .parse(content)
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
};
