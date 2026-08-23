import type { AgentPolicy, AgentTurnBudget } from "@chia/agent-runtime/types";

import { labelOf, tierOf } from "./tools/registry.ts";
import { summarizeToolResult } from "./tools/summarize.ts";

/**
 * The writing agent's {@link AgentPolicy}.
 *
 * This is what `@chia/agent-runtime` consumes instead of reaching into a module-level table of *this*
 * package's tool names — which is what previously made the gate unusable by a second agent kind.
 *
 * `tierOf` falls back to the most restrictive tier for an unknown name. Within this kind that is a
 * safe default (a tool it does not recognise should not run unsupervised); the point of injecting
 * the policy is that another kind gets to choose its own fallback rather than inheriting `commit`.
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
 * What one writing turn may spend. A research-heavy turn (search, read several posts, fetch a
 * few sources, stage a draft, revise it) lands around twenty calls, so the soft limit leaves
 * headroom for that while still ending a turn that only re-issues the same search.
 */
export const writingTurnBudget: AgentTurnBudget = {
  maxToolCalls: 40,
  hardMaxToolCalls: 60,
  maxRepeats: 3,
  maxDurationMs: 15 * 60 * 1000,
};
