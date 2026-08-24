import {
  compact,
  DEFAULT_COMPACTION_SETTINGS,
  prepareCompaction,
  shouldCompact,
} from "@earendil-works/pi-agent-core";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Api, Model, Models } from "@earendil-works/pi-ai";

import type { CompactionEntry, SessionEntry } from "../session/entries.ts";
import { contextEntries } from "../session/entries.ts";
import type { SessionTree } from "../session/tree.ts";
import { estimateBranchContextTokens } from "../session/usage.ts";
import type { AgentCompactionResult } from "../types.ts";

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
    /* SAFETY: Context entries carry Pi's entry fields except the storage-assigned `seq`; preparation reads only messages. */ contextEntries(
      branch
    ) as never,
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

  const entry: CompactionEntry = {
    type: "compaction",
    id: session.newEntryId(),
    parentId: await session.getLeafId(),
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
