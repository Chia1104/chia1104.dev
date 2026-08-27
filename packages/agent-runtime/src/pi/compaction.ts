import {
  compact,
  DEFAULT_COMPACTION_SETTINGS,
  prepareCompaction,
  shouldCompact,
} from "@earendil-works/pi-agent-core";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Api, Model, Models } from "@earendil-works/pi-ai";

import type {
  CompactionEntry,
  NewSessionEntry,
  SessionEntry,
} from "../session/entries.ts";
import { contextEntries } from "../session/entries.ts";
import type { SessionTree } from "../session/tree.ts";
import { estimateBranchContextTokens } from "../session/usage.ts";
import type { AgentCompactionResult } from "../types.ts";

/**
 * The window the compaction threshold is measured against when the summariser is not the
 * session's model: the smaller of the two. The session model's window is what the branch
 * fills; the summariser must still be able to read the whole branch it condenses, so a
 * smaller summariser brings compaction forward rather than being handed more than it can take.
 */
export const compactionContextWindow = (
  model: Pick<Model<Api>, "contextWindow">,
  summariser: Pick<Model<Api>, "contextWindow">
): number => Math.min(model.contextWindow, summariser.contextWindow);

/** Whether the active branch has crossed Pi's own compaction threshold. */
export const shouldCompactBranch = (
  entries: readonly SessionEntry[],
  contextWindow: number
): boolean => {
  const tokens = estimateBranchContextTokens(entries);
  if (tokens === 0) return false;
  return shouldCompact(tokens, contextWindow, DEFAULT_COMPACTION_SETTINGS);
};

export interface CompactSessionOptions {
  session: SessionTree;
  models: Models;
  model: Model<Api>;
  thinkingLevel: ThinkingLevel;
  customInstructions?: string;
  signal?: AbortSignal;
}

const compactBranch = async (
  branch: readonly SessionEntry[],
  {
    session,
    models,
    model,
    thinkingLevel,
    customInstructions,
    signal,
  }: CompactSessionOptions
): Promise<AgentCompactionResult | null> => {
  const prepared = prepareCompaction(
    contextEntries(branch),
    DEFAULT_COMPACTION_SETTINGS
  );
  if (!prepared.ok) throw prepared.error;
  if (!prepared.value) return null;

  const compacted = await compact(
    prepared.value,
    models,
    model,
    customInstructions,
    signal,
    thinkingLevel
  );
  if (!compacted.ok) throw compacted.error;
  const result = compacted.value;

  // Parented under the leaf of the branch that was summarised, not the leaf re-read afterwards:
  // the compaction's ancestors must be exactly what its summary covers.
  const entry: NewSessionEntry<CompactionEntry> = {
    type: "compaction",
    id: session.newEntryId(),
    parentId: branch.at(-1)?.id ?? null,
    timestamp: Date.now(),
    summary: result.summary,
    tokensBefore: result.tokensBefore,
    retainedTail: result.retainedTail ?? [],
    details: result.details,
    usage: result.usage,
  };
  await session.appendEntry(entry);

  return { summary: result.summary, tokensBefore: result.tokensBefore };
};

/**
 * Summarises the active branch with Pi's compaction and appends the compaction entry as the new
 * leaf. `null` when the branch is empty or already ends in a compaction.
 */
export const compactSession = async (
  options: CompactSessionOptions
): Promise<AgentCompactionResult | null> =>
  compactBranch(await options.session.getBranch(), options);

/** Compacts only when the persisted branch is under context pressure. */
export const compactSessionIfNeeded = async (
  options: CompactSessionOptions,
  contextWindow: number
): Promise<AgentCompactionResult | null> => {
  const branch = await options.session.getBranch();
  if (!shouldCompactBranch(branch, contextWindow)) return null;
  return compactBranch(branch, options);
};
