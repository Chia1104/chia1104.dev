import { sumBy } from "es-toolkit";

import type { AgentMessage } from "../messages.ts";
import { StopReason } from "../messages.ts";

import type { SessionEntry } from "./entries.ts";
import { contextEntries } from "./entries.ts";

/** Four characters a token: close enough for English and code, generous for CJK. */
const CHARS_PER_TOKEN = 4;

const messageChars = (message: AgentMessage): number => {
  if (!Array.isArray(message.content)) return message.content.length;
  let chars = 0;
  for (const part of message.content) {
    switch (part.type) {
      case "text":
        chars += part.text.length;
        break;
      case "thinking":
        chars += part.thinking.length;
        break;
      case "toolCall":
        chars += part.name.length + JSON.stringify(part.arguments).length;
        break;
      default: {
        const _exhaustive: never = part;
        return _exhaustive;
      }
    }
  }
  return chars;
};

export const estimateMessageTokens = (message: AgentMessage): number =>
  Math.ceil(messageChars(message) / CHARS_PER_TOKEN);

const entryMessages = (entry: SessionEntry): AgentMessage[] => {
  switch (entry.type) {
    case "message":
      return [entry.message];
    case "compaction":
      return [
        {
          role: "user",
          content: entry.summary,
          timestamp: entry.timestamp,
        },
        ...entry.retainedTail,
      ];
    case "branch_summary":
      return [
        { role: "user", content: entry.summary, timestamp: entry.timestamp },
      ];
    default: {
      const _exhaustive: never = entry;
      return _exhaustive;
    }
  }
};

/**
 * Tokens the next provider request will carry on the active branch: the newest completed reply's
 * reported context, plus an estimate of what came after it. Before any reply since the newest
 * compaction, the whole projection is estimated, since usage behind a compaction describes a
 * context that no longer exists.
 */
export const estimateBranchContextTokens = (
  entries: readonly SessionEntry[]
): number => {
  const branch = contextEntries(entries);
  const start = Math.max(
    0,
    branch.findLastIndex((entry) => entry.type === "compaction")
  );
  const tail = branch.slice(start);
  const lastReply = tail.findLastIndex(
    (entry) =>
      entry.type === "message" &&
      entry.message.role === "assistant" &&
      entry.message.stopReason !== StopReason.Error &&
      entry.message.stopReason !== StopReason.Aborted
  );
  const reported = tail[lastReply];
  const base =
    reported?.type === "message" && reported.message.role === "assistant"
      ? reported.message.usage.totalTokens
      : 0;
  const estimated = sumBy(
    (lastReply === -1 ? tail : tail.slice(lastReply + 1)).flatMap(
      entryMessages
    ),
    estimateMessageTokens
  );
  return base + estimated;
};
