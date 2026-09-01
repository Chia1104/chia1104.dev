import type { ContentToolContext } from "@chia/agent-content/types";
import type { AgentTool } from "@chia/agent-runtime/types";

/**
 * One tier: every tool is a read. The host still stores a tier per tool call.
 */
export type PublicToolTier = (typeof PUBLIC_TOOL_TIERS)[number];

export const PUBLIC_TOOL_TIERS = ["read"] as const;

/**
 * Per-turn tool context. The host builds the port with published-only visibility; no tool
 * here can widen that.
 */
export type PublicToolContext = ContentToolContext;

export type PublicTool = AgentTool<PublicToolContext>;
