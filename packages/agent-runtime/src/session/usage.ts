import {
  estimateContextTokens,
  estimateTokens,
  getLastAssistantUsage,
} from "@earendil-works/pi-agent-core";

import { buildBranchContext } from "./context.ts";
import type { SessionEntry } from "./entries.ts";
import { contextEntries } from "./entries.ts";

/**
 * Estimates the tokens the next provider request will carry for an active session branch.
 *
 * Provider usage is authoritative once an assistant has answered on the current compaction
 * horizon. Immediately after compaction, retained assistant messages still carry their old,
 * pre-compaction usage; in that one state the rebuilt summary and retained tail are estimated
 * from their content instead.
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
  if (
    getLastAssistantUsage(
      /* SAFETY: Context entries carry Pi's entry fields; the usage lookup reads only messages. */ entriesAfterCompaction as never
    )
  ) {
    return estimateContextTokens(messages).tokens;
  }

  return messages.reduce(
    (total, message) => total + estimateTokens(message),
    0
  );
};
