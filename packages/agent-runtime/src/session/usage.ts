import {
  estimateContextTokens,
  estimateTokens,
  getLastAssistantUsage,
} from "@earendil-works/pi-agent-core";

import { buildBranchContext } from "./context.ts";
import type { SessionEntry } from "./entries.ts";
import { contextEntries } from "./entries.ts";

/**
 * Tokens the next provider request will carry on the active branch.
 * After compaction, retained assistant usage is stale; estimate the rebuilt
 * summary and tail from content instead.
 */
export const estimateBranchContextTokens = (
  entries: readonly SessionEntry[]
): number => {
  if (entries.length === 0) return 0;

  const lastCompactionIndex = entries.findLastIndex(
    (entry) => entry.type === "compaction"
  );
  const messages = buildBranchContext(entries).messages;

  if (lastCompactionIndex === -1) {
    return estimateContextTokens(messages).tokens;
  }

  const entriesAfterCompaction = contextEntries(
    entries.slice(lastCompactionIndex + 1)
  );
  if (getLastAssistantUsage(entriesAfterCompaction)) {
    return estimateContextTokens(messages).tokens;
  }

  return messages.reduce(
    (total, message) => total + estimateTokens(message),
    0
  );
};
