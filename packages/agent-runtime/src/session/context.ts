import type { ModelMessage, TextPart } from "@tanstack/ai";

import type { AgentMessage, AssistantMessage } from "../messages.ts";
import { contentText, StopReason } from "../messages.ts";
import { xmlBlock } from "../prompts.ts";

import type { SessionEntry } from "./entries.ts";
import { contextEntries } from "./entries.ts";

/**
 * Projects a branch into what the model sees: the newest compaction as its summary and retained
 * tail, branch summaries, and the messages after them.
 *
 * It must stay deterministic: a turn's provider request is the previous projection plus the
 * entries it appended, and any drift between the two breaks the provider's cached prefix.
 */

/** A summary as the model reads it: what it stands for, then the summary itself. */
const summaryMessage = (lead: string, summary: string): ModelMessage => ({
  role: "user",
  content: `${lead}\n\n${xmlBlock("summary", summary)}`,
});

/** Result the model reads for a call whose turn stopped before it ran. */
const UNFINISHED_CALL = "The call did not complete; its turn was stopped.";

export interface BranchContextOptions {
  /** The wire the turn speaks; thinking signatures from any other are not sent back. */
  api: string;
  /**
   * Calls left waiting on the operator. They keep no result so the engine can run them once
   * approved; every other call without a result reads as stopped.
   */
  pendingToolCallIds?: ReadonlySet<string>;
}

export const buildBranchContext = (
  entries: readonly SessionEntry[],
  options: BranchContextOptions
): ModelMessage[] => {
  const messages = fromNewestCompaction(contextEntries(entries)).flatMap(
    (entry) => messagesOf(entry, options.api)
  );
  return closeUnfinishedCalls(messages, options.pendingToolCallIds);
};

/** Everything before the newest compaction is what its summary replaces. */
const fromNewestCompaction = (entries: SessionEntry[]): SessionEntry[] => {
  const index = entries.findLastIndex((entry) => entry.type === "compaction");
  return index === -1 ? entries : entries.slice(index);
};

/** A reply the provider never completed carries nothing the model should read back. */
const isContextMessage = (message: AgentMessage): boolean =>
  message.role !== "assistant" ||
  (message.stopReason !== StopReason.Error &&
    message.stopReason !== StopReason.Aborted);

const assistantMessage = (
  message: AssistantMessage,
  api: string
): ModelMessage => {
  const text = contentText(message.content);
  const toolCalls = message.content.flatMap((part) =>
    part.type === "toolCall"
      ? [
          {
            id: part.id,
            type: "function" as const,
            function: {
              name: part.name,
              arguments: JSON.stringify(part.arguments),
            },
          },
        ]
      : []
  );
  // Reasoning goes back only as the provider issued it: signed, and to the wire that signed it.
  const thinking =
    message.api === api
      ? message.content.flatMap((part) =>
          part.type === "thinking" && part.thinkingSignature !== undefined
            ? [{ content: part.thinking, signature: part.thinkingSignature }]
            : []
        )
      : [];
  return {
    role: "assistant",
    content: text.length > 0 ? text : null,
    ...(toolCalls.length > 0 && { toolCalls }),
    ...(thinking.length > 0 && { thinking }),
  };
};

const toModelMessage = (message: AgentMessage, api: string): ModelMessage => {
  switch (message.role) {
    case "user":
      return {
        role: "user",
        content: Array.isArray(message.content)
          ? message.content.map((part): TextPart => ({
              type: "text",
              content: part.text,
            }))
          : message.content,
      };
    case "assistant":
      return assistantMessage(message, api);
    case "toolResult": {
      const text = contentText(message.content);
      return {
        role: "tool",
        toolCallId: message.toolCallId,
        content: text,
        ...(message.isError && { error: text }),
      };
    }
    default: {
      const _exhaustive: never = message;
      return _exhaustive;
    }
  }
};

const messagesOf = (entry: SessionEntry, api: string): ModelMessage[] => {
  switch (entry.type) {
    case "message":
      return isContextMessage(entry.message)
        ? [toModelMessage(entry.message, api)]
        : [];
    case "compaction":
      return [
        summaryMessage(
          "The conversation history before this point was compacted into the following summary:",
          entry.summary
        ),
        ...entry.retainedTail
          .filter(isContextMessage)
          .map((message) => toModelMessage(message, api)),
      ];
    case "branch_summary":
      return entry.summary
        ? [
            summaryMessage(
              "The following is a summary of a branch that this conversation came back from:",
              entry.summary
            ),
          ]
        : [];
    default: {
      const _exhaustive: never = entry;
      return _exhaustive;
    }
  }
};

/**
 * Providers refuse a tool call with no result, and a turn stopped mid-batch leaves some. Each gets
 * a stopped result right after the results it does have; calls waiting on the operator do not.
 */
const closeUnfinishedCalls = (
  messages: readonly ModelMessage[],
  pending: ReadonlySet<string> = new Set()
): ModelMessage[] => {
  const answered = new Set(
    messages.flatMap((message) =>
      message.role === "tool" && message.toolCallId ? [message.toolCallId] : []
    )
  );
  const closed: ModelMessage[] = [];
  let open: string[] = [];
  const flush = () => {
    for (const toolCallId of open) {
      closed.push({
        role: "tool",
        toolCallId,
        content: UNFINISHED_CALL,
        error: UNFINISHED_CALL,
      });
    }
    open = [];
  };
  for (const message of messages) {
    if (message.role !== "tool") flush();
    closed.push(message);
    if (message.role === "assistant") {
      open = (message.toolCalls ?? [])
        .map((call) => call.id)
        .filter((id) => !answered.has(id) && !pending.has(id));
    }
  }
  flush();
  return closed;
};
