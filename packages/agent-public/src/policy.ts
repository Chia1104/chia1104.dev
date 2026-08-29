import type { AgentPolicy, AgentTurnBudget } from "@chia/agent-runtime/types";

import { labelOf, tierOf } from "./tools/registry.ts";
import { summarizeToolResult } from "./tools/summarize.ts";

/**
 * The public agent's {@link AgentPolicy}. Nothing here changes state, so nothing needs
 * approval and there is no state scope for the client to refetch.
 */
export const publicPolicy: AgentPolicy = {
  tierOf,
  labelOf,
  requiresApproval: () => false,
  summarize: summarizeToolResult,
};

/**
 * What one public turn may spend. A question is answered by a search and one or two reads;
 * the soft limit leaves room for a follow-up search when the first misses, and the hard limit
 * ends a model that keeps browsing. The wall-clock is the visitor's patience, not the
 * model's: a public chat that takes minutes is abandoned before it answers.
 */
export const publicTurnBudget: AgentTurnBudget = {
  maxToolCalls: 6,
  hardMaxToolCalls: 10,
  maxRepeats: 2,
  maxDurationMs: 2 * 60 * 1000,
};
