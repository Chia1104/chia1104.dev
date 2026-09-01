import type { AgentPolicy, AgentTurnBudget } from "@chia/agent-runtime/types";

import { labelOf, tierOf } from "./tools/registry.ts";
import { summarizeToolResult } from "./tools/summarize.ts";

/**
 * Nothing here changes state, so nothing needs approval and there is no state scope for the
 * client to refetch.
 */
export const publicPolicy: AgentPolicy = {
  tierOf,
  labelOf,
  requiresApproval: () => false,
  summarize: summarizeToolResult,
};

/**
 * Soft cap leaves room for a follow-up search; hard cap ends a model that keeps browsing.
 * Wall-clock is the visitor's patience: a public chat that takes minutes is abandoned.
 */
export const publicTurnBudget: AgentTurnBudget = {
  maxToolCalls: 6,
  hardMaxToolCalls: 10,
  maxRepeats: 2,
  maxDurationMs: 2 * 60 * 1000,
};
