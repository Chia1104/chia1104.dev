import type { AgentPolicy, AgentTurnBudget } from "@chia/agent-runtime/types";

import { labelOf, tierOf } from "./tools/registry.ts";
import { summarizeToolResult } from "./tools/summarize.ts";

/**
 * Unknown names fall back to the most restrictive tier so an unrecognized tool cannot run
 * unsupervised.
 */
export const writingPolicy: AgentPolicy = {
  tierOf,
  labelOf,
  requiresApproval: (tier) => tier === "commit",
  changesState: (tier) => tier === "draft" || tier === "commit",
  stateScope: "draft",
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
