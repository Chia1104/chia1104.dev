import type { AgentMessage, JsonValue } from "@earendil-works/pi-agent-core";
import type { Usage } from "@earendil-works/pi-ai";

import type { AgentAttachment } from "../types.ts";

/**
 * The persisted session tree, owned here rather than imported from Pi.
 *
 * Discriminants and payload fields match Pi's own entry union, so rows in `agent.session_entry`
 * read back unchanged and Pi's compaction helpers accept these entries structurally. `label`
 * is the one entry Pi no longer models as a tree node; it stays one here because that is where
 * the rows already live and a navigation label is a tree event.
 */

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
  details?: JsonValue;
  usage?: Usage;
  /** Whether a Pi hook wrote the entry. Always `false` here: the runtime writes every entry itself. */
  fromHook: boolean;
}

export interface BranchSummaryEntry extends SessionEntryBase {
  type: "branch_summary";
  /** The leaf the session moved to when the branch was left; `null` at the root. */
  fromId: string | null;
  summary: string;
  details?: JsonValue;
  usage?: Usage;
  fromHook: boolean;
}

export interface CustomEntry extends SessionEntryBase {
  type: "custom";
  customType: string;
  data?: JsonValue;
}

export interface LabelEntry extends SessionEntryBase {
  type: "label";
  targetId: string;
  label: string;
}

/** Entries that project into the model's context. */
export type ContextEntry =
  | MessageEntry
  | CompactionEntry
  | BranchSummaryEntry
  | CustomEntry;

export type SessionEntry = ContextEntry | LabelEntry;

/**
 * An entry as a caller builds it: everything but the `seq` storage assigns when it lands.
 * Distributes over the union so `NewSessionEntry<MessageEntry>` keeps its discriminant.
 */
export type NewSessionEntry<TEntry extends SessionEntry = SessionEntry> =
  TEntry extends SessionEntry ? Omit<TEntry, "seq"> : never;

const CONTEXT_ENTRY_TYPES: ReadonlySet<string> = new Set<ContextEntry["type"]>([
  "message",
  "compaction",
  "branch_summary",
  "custom",
]);

/**
 * Labels annotate the tree, and rows of retired types (`session_info`, `leaf`, `model_change`,
 * `thinking_level_change`, `active_tools_change`) written by earlier Pi releases are skipped
 * rather than failing the whole session.
 */
export const isContextEntry = (entry: SessionEntry): entry is ContextEntry =>
  CONTEXT_ENTRY_TYPES.has(entry.type);

export const contextEntries = (
  entries: readonly SessionEntry[]
): ContextEntry[] => entries.filter(isContextEntry);

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
