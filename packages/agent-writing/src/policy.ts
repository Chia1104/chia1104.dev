import type { AgentPolicy, AgentTurnBudget } from "@chia/agent-runtime/types";

import { toolInfo } from "./tools/registry.ts";
import { summarizeToolResult } from "./tools/summarize.ts";
import { WritingToolTier } from "./types.ts";

export const writingPolicy: AgentPolicy = {
  toolInfo,
  requiresApproval: (tier) => tier === WritingToolTier.Commit,
  summarize: summarizeToolResult,
};

/**
 * Soft cap leaves headroom for a research-heavy turn; hard cap ends a loop that only re-issues
 * the same search.
 */
export const writingTurnBudget: AgentTurnBudget = {
  maxToolCalls: 40,
  hardMaxToolCalls: 60,
  maxRepeats: 3,
  maxDurationMs: 15 * 60 * 1000,
};
