import type { SessionTreeEntry } from "@earendil-works/pi-agent-core";
import * as z from "zod";

import { errorOfAssistantMessage } from "../pi/errors.ts";
import type { AgentEventPresentation } from "../types.ts";

import { clipDetails } from "./clip.ts";
import { isOperatorDecisionText } from "./operator-decision.ts";
import type { AgentWireEvent } from "./schema.ts";

// ============================================
// Transcript replay: session entries → wire events
// ============================================

/**
 * Rebuilds wire events from a persisted branch so a reconnecting client renders through
 * exactly the same fold as the live stream. Deltas are not replayed — a completed message
 * arrives as a single `assistant:end`.
 */
export const entriesToWireEvents = (
  entries: readonly SessionTreeEntry[],
  options: AgentEventPresentation
): AgentWireEvent[] => {
  const events: AgentWireEvent[] = [];

  for (const entry of entries) {
    if (entry.type === "compaction") {
      events.push({
        type: "session:compacted",
        summary: entry.summary,
        tokensBefore: entry.tokensBefore,
      });
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
      const messageId = `a:${entry.id}`;
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
        events.push({ type: "error", ...errorOfAssistantMessage(message) });
      }

      for (const part of message.content) {
        if (part.type !== "toolCall") continue;
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
