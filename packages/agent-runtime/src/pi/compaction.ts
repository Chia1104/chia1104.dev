import {
  DEFAULT_COMPACTION_SETTINGS,
  estimateContextTokens,
  shouldCompact,
} from "@earendil-works/pi-agent-core";
import type {
  AgentHarness,
  Session,
  SessionTreeEntry,
} from "@earendil-works/pi-agent-core";

import type { AgentCompactionResult } from "../types.ts";

/** Whether the active branch has crossed Pi's own compaction threshold. */
export const shouldCompactBranch = (
  entries: SessionTreeEntry[],
  contextWindow: number
): boolean => {
  const messages = entries
    .filter((entry) => entry.type === "message")
    .map((entry) => entry.message);
  if (messages.length === 0) return false;
  const { tokens } = estimateContextTokens(messages);
  return shouldCompact(tokens, contextWindow, DEFAULT_COMPACTION_SETTINGS);
};

/** Compacts a live Pi harness only when its persisted branch is under context pressure. */
export const compactPiHarnessIfNeeded = async <
  TContext extends object | undefined,
>(
  harness: AgentHarness<TContext>,
  session: Session,
  contextWindow: number
): Promise<AgentCompactionResult | null> => {
  const entries = await session.getBranch();
  if (!shouldCompactBranch(entries, contextWindow)) return null;
  const result = await harness.compact();
  return { summary: result.summary, tokensBefore: result.tokensBefore };
};
