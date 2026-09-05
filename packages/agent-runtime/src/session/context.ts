import {
  createBranchSummaryMessage,
  createCompactionSummaryMessage,
} from "@earendil-works/pi-agent-core";
import type { AgentMessage } from "@earendil-works/pi-agent-core";

import type { ContextEntry, SessionEntry } from "./entries.ts";
import { contextEntries } from "./entries.ts";

/**
 * Projects a branch into what the model sees: the newest compaction as its summary and retained
 * tail, branch summaries, and the messages after them.
 *
 * Mirrors Pi's own projection, which 0.85 keeps internal to its harness, so the transcript reads
 * as it would under Pi. It must stay deterministic: a turn's provider request is the previous
 * projection plus the entries it appended, and any drift between the two breaks the provider's
 * cached prefix.
 */
export const buildBranchContext = (
  entries: readonly SessionEntry[]
): AgentMessage[] =>
  fromNewestCompaction(contextEntries(entries)).flatMap(messagesOf);

/** Everything before the newest compaction is what its summary replaces. */
const fromNewestCompaction = (entries: ContextEntry[]): ContextEntry[] => {
  const index = entries.findLastIndex((entry) => entry.type === "compaction");
  return index === -1 ? entries : entries.slice(index);
};

/** A reply the provider never completed carries nothing the model should read back. */
const isContextMessage = (message: AgentMessage): boolean =>
  message.role !== "assistant" ||
  (message.stopReason !== "error" &&
    message.stopReason !== "aborted" &&
    message.stopReason !== "deferred");

const messagesOf = (entry: ContextEntry): AgentMessage[] => {
  switch (entry.type) {
    case "message":
      return isContextMessage(entry.message) ? [entry.message] : [];
    case "compaction":
      return [
        createCompactionSummaryMessage(
          entry.summary,
          entry.tokensBefore,
          entry.timestamp
        ),
        ...entry.retainedTail.filter(isContextMessage),
      ];
    case "branch_summary":
      return entry.summary
        ? [
            createBranchSummaryMessage(
              entry.summary,
              entry.fromId,
              entry.timestamp
            ),
          ]
        : [];
    case "custom":
      return [];
  }
};
