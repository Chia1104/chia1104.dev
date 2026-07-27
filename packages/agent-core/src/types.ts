import type {
  AgentHarnessTool,
  Skill,
  PromptTemplate,
  ThinkingLevel,
} from "@earendil-works/pi-agent-core";

export type { ThinkingLevel, Skill, PromptTemplate };

/**
 * Generic agent vocabulary. Nothing here knows what an agent is *for*.
 *
 * Each agent kind (`@chia/agent-writing`, and whatever comes next) defines its own tiers, tools,
 * prompts and tool context, then hands them to {@link createAgentHarness} together with a
 * {@link AgentPolicy}.
 */

/**
 * A tool tier, as a plain string.
 *
 * Deliberately **not** a union: tiers are per-kind policy. The writing agent uses
 * `read | draft | commit`; a public-facing agent would have no `commit` at all, and something that
 * sends email would want a tier this package has never heard of. Narrowing lives in each kind's own
 * types, and the wire contract carries the string.
 */
export type ToolTier = string;

/** Discriminates rows in `agent_session`, and selects a runtime implementation. */
export type AgentKind = string;

/**
 * How a kind classifies and gates its own tools.
 *
 * This is the seam that used to be a module-level lookup table of the writing agent's tools. Left
 * as a singleton it would silently misclassify every tool of a second agent kind — unknown names
 * fell through to the most restrictive tier, so nothing would ever run.
 */
export interface AgentPolicy {
  /** Tier for a tool name. Must handle unknown names rather than throwing. */
  tierOf: (toolName: string) => ToolTier;
  /** Human-readable label for the transcript. */
  labelOf: (toolName: string) => string;
  /** Whether a tier needs an explicit human decision before it may execute. */
  requiresApproval: (tier: ToolTier) => boolean;
  /**
   * Whether a successful call in this tier changed durable state the client should refetch.
   * Drives the `state:changed` wire event.
   */
  changesState?: (tier: ToolTier) => boolean;
  /** Condenses a tool result into one transcript line. Keeps wire events small. */
  summarize: (toolName: string, result: unknown, isError: boolean) => string;
  /** Scope label carried on `state:changed`, e.g. `"draft"`. */
  stateScope?: string;
}

/** Tool definition for a kind whose per-turn context is `TContext`. */
export type AgentTool<TContext extends object> = AgentHarnessTool<TContext>;

// ============================================
// Session settings
// ============================================

/**
 * Runtime settings persisted on `agent_session`.
 *
 * `autoApprove` holds tier names as strings for the same reason {@link ToolTier} is a string.
 */
export interface AgentSessionSettings {
  providerId: string;
  modelId: string;
  thinkingLevel: ThinkingLevel;
  activeToolNames: string[] | null;
  autoApprove: ToolTier[];
}

/** Defaults a {@link AgentSessionSettings} row is created with when the caller omits them. */
export interface AgentSessionDefaults {
  providerId: string;
  modelId: string;
  thinkingLevel?: ThinkingLevel;
}
