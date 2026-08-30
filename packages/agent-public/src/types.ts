/**
 * `@chia/agent-public` — the site's reading assistant.
 *
 * The *domain* half of the agent visitors talk to on the public site: it answers questions
 * about the published posts and nothing else. Its tools are exactly `@chia/agent-content`'s
 * read tools, so what this package owns is the policy around them — which models a visitor may
 * run, how much one turn may spend, and the prompt — not tools of its own. The concrete Pi
 * turn, provider/model construction, session persistence and wire events live in
 * `@chia/agent-runtime`.
 */

import type { ContentToolContext } from "@chia/agent-content/types";
import type { AgentTool } from "@chia/agent-runtime/types";

/**
 * One tier: every tool is a read, nothing needs approval. The host still stores a tier per
 * tool call, so the vocabulary exists; it is just never wider than this.
 */
export type PublicToolTier = (typeof PUBLIC_TOOL_TIERS)[number];

export const PUBLIC_TOOL_TIERS = ["read"] as const;

/**
 * Per-turn context handed to every tool. Only the read port: the port the host builds for this
 * kind sees published posts alone, and no tool here can widen that.
 */
export type PublicToolContext = ContentToolContext;

export type PublicTool = AgentTool<PublicToolContext>;
