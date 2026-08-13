import type { AgentPolicy } from "@chia/agent-runtime";

import { TOOL_LABEL_BY_NAME, TOOL_TIER_BY_NAME } from "./tools/registry.ts";
import { summarizeToolResult } from "./tools/summarize.ts";
import { WRITING_APPROVAL_TIERS, WRITING_STATE_TIERS } from "./types.ts";
import type { WritingToolTier } from "./types.ts";

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
  tierOf: (toolName) => TOOL_TIER_BY_NAME[toolName] ?? "commit",
  labelOf: (toolName) => TOOL_LABEL_BY_NAME[toolName] ?? toolName,
  requiresApproval: (tier) =>
    WRITING_APPROVAL_TIERS.includes(tier as WritingToolTier),
  changesState: (tier) => WRITING_STATE_TIERS.includes(tier as WritingToolTier),
  stateScope: "draft",
  summarize: summarizeToolResult,
};
