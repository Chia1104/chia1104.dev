import type { AgentMessage, Usage } from "../messages.ts";
import type { AgentAttachment } from "../wire/schema.ts";

/** The persisted session tree; one shape for every row it holds. */

export interface SessionEntryBase {
  id: string;
  parentId: string | null;
  /**
   * Storage-assigned on append, strictly increasing within a session: the order entries were
   * persisted in, across every branch.
   * The tree order is `parentId`; `seq` is the cursor. "Everything persisted before this point"
   * is `seq <= n`, whichever branch is active.
   */
  seq: number;
  /** Unix ms. */
  timestamp: number;
}

export interface MessageEntry extends SessionEntryBase {
  type: "message";
  message: AgentMessage;
  /**
   * User messages only. The rendered attachments are the first text block of `message`, the
   * operator's own words the last; replay shows the words and these as chips.
   */
  attachments?: AgentAttachment[];
}

export interface CompactionEntry extends SessionEntryBase {
  type: "compaction";
  summary: string;
  tokensBefore: number;
  /** Recent messages kept verbatim after the summary. Always an array once persisted. */
  retainedTail: AgentMessage[];
  usage?: Usage;
}

export interface BranchSummaryEntry extends SessionEntryBase {
  type: "branch_summary";
  /** The leaf the session moved to when the branch was left; `null` at the root. */
  fromId: string | null;
  summary: string;
  usage?: Usage;
}

export type SessionEntry = MessageEntry | CompactionEntry | BranchSummaryEntry;

/**
 * An entry as a caller builds it: everything but the `seq` storage assigns when it lands.
 * Distributes over the union so `NewSessionEntry<MessageEntry>` keeps its discriminant.
 */
export type NewSessionEntry<TEntry extends SessionEntry = SessionEntry> =
  TEntry extends SessionEntry ? Omit<TEntry, "seq"> : never;

const SESSION_ENTRY_TYPES: ReadonlySet<string> = new Set<SessionEntry["type"]>([
  "message",
  "compaction",
  "branch_summary",
]);

/**
 * Rows of types this runtime never writes (`label`, `custom`, and `session_info`, `leaf`,
 * `model_change`, `thinking_level_change`, `active_tools_change` from earlier engines) stay
 * in the tree walk, since entries may hang off them, and are skipped by everything that reads
 * content.
 */
export const contextEntries = (
  entries: readonly SessionEntry[]
): SessionEntry[] =>
  entries.filter((entry) => SESSION_ENTRY_TYPES.has(entry.type));

/** The entries persisted up to and including `seq`, on whichever branch they sit. */
export const entriesUpToSeq = <TEntry extends SessionEntry>(
  entries: readonly TEntry[],
  seq: number
): TEntry[] => entries.filter((entry) => entry.seq <= seq);

export interface SessionStats {
  messageCount: number;
  cachedTokens: number;
  uncachedTokens: number;
  totalTokens: number;
  costTotal: number;
}

/**
 * Aggregated from provider-reported assistant, compaction and branch-summary usage.
 * Summed as per-call figures rather than reading the last message, so a compacted session still
 * reports everything it actually processed and cost.
 */
export const computeSessionStats = (
  entries: readonly SessionEntry[]
): SessionStats => {
  const stats: SessionStats = {
    messageCount: 0,
    cachedTokens: 0,
    uncachedTokens: 0,
    totalTokens: 0,
    costTotal: 0,
  };

  for (const entry of entries) {
    if (entry.type === "message") stats.messageCount += 1;
    const usage =
      entry.type === "message"
        ? entry.message.role === "assistant"
          ? entry.message.usage
          : undefined
        : entry.type === "compaction" || entry.type === "branch_summary"
          ? entry.usage
          : undefined;
    if (!usage) continue;
    stats.cachedTokens += usage.cacheRead;
    stats.uncachedTokens += usage.input + usage.cacheWrite;
    stats.totalTokens +=
      usage.input + usage.output + usage.cacheRead + usage.cacheWrite;
    stats.costTotal += usage.cost.total;
  }

  return stats;
};
