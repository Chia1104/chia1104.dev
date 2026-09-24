import type { PromptTemplate, Skill } from "@earendil-works/pi-agent-core";
import type { Usage } from "@earendil-works/pi-ai";

import type { AgentUsageSource } from "@chia/db/schema";

import type { OperatorDecision } from "./wire/operator-decision.ts";
import type { AgentAttachment } from "./wire/schema.ts";

export type { PromptTemplate, Skill };

/** Pi's reasoning levels, from none to the most; the compiler checks them wherever a level reaches Pi. */
export const ThinkingLevel = {
  Off: "off",
  Minimal: "minimal",
  Low: "low",
  Medium: "medium",
  High: "high",
  XHigh: "xhigh",
  Max: "max",
} as const;

export type ThinkingLevel = (typeof ThinkingLevel)[keyof typeof ThinkingLevel];

export type ToolTier = string;

/** What the host and clients know about a tool without binding it to a turn. */
export interface AgentToolInfo {
  label: string;
  tier: ToolTier;
  /** The kind state a successful call changes; announced to clients as `state:changed`. */
  changes?: string;
}

export interface AgentPolicy {
  /** Resolves unknown names too, to the kind's most restrictive tier. */
  toolInfo: (toolName: string) => AgentToolInfo;
  requiresApproval: (tier: ToolTier) => boolean;
  summarize: <TResult>(
    toolName: string,
    result: TResult,
    isError: boolean
  ) => string;
}

/** Presentation policy shared by live Pi events and persisted transcript replay. */
export type AgentEventPresentation = Pick<
  AgentPolicy,
  "toolInfo" | "summarize"
>;

/** A tool call as the turn's hooks see it before execution. */
export interface ToolCallRequest {
  toolCallId: string;
  toolName: string;
  /** Validated arguments. */
  input: unknown;
}

/** A gated call the turn stopped on, waiting for the operator. */
export interface ApprovalRequest {
  toolCallId: string;
  toolName: string;
  tier: ToolTier;
  args: unknown;
  /** What an approval of this request is good for; see `PiToolCallGateOptions.approvalKeyOf`. */
  key: string;
}

/** Refuses a call. The reason returns to the model as the tool's error result. */
export interface ToolCallRefusal {
  block: true;
  reason: string;
  /** Asks Pi to end the run after this tool batch instead of letting the model continue. */
  terminate?: true;
}

/** What a turn runs with. The model is the session's own or, when it names none, the kind's effective default. */
export interface AgentSessionSettings {
  providerId: string;
  modelId: string;
  thinkingLevel: ThinkingLevel;
  activeToolNames: string[] | null;
  autoApprove: ToolTier[];
}

/** Kind code defaults, possibly overridden by the operator's kind configuration. */
export interface AgentSessionDefaults {
  providerId: string;
  modelId: string;
  thinkingLevel?: ThinkingLevel;
  autoApprove?: ToolTier[];
}

export interface AgentCompactionResult {
  summary: string;
  tokensBefore: number;
}

export interface AgentNavigationOptions {
  summarize?: boolean;
}

export interface AgentNavigationResult {
  cancelled: boolean;
}

export interface AgentTurnMessage {
  text: string;
  template?: { name: string; args?: string[] };
  attachments?: AgentAttachment[];
  /**
   * Operator decision this turn relays after an approval.
   * Announced on the wire before the model runs; the user message is marked as not
   * operator-typed.
   */
  decision?: OperatorDecision;
}

/**
 * Why a turn failed, coarse enough for a client to pick the next step.
 * Closed vocabulary shared by the wire `error` event.
 */
export const AgentErrorKind = {
  Auth: "auth",
  Quota: "quota",
  RateLimited: "rate_limited",
  ContextOverflow: "context_overflow",
  BudgetExhausted: "budget_exhausted",
  Refused: "refused",
  ModelUnavailable: "model_unavailable",
  Provider: "provider",
  Internal: "internal",
} as const;

export type AgentErrorKind =
  (typeof AgentErrorKind)[keyof typeof AgentErrorKind];

export interface AgentTurnError {
  kind: AgentErrorKind;
  message: string;
}

/**
 * What one turn may consume before the runtime stops it.
 * A turn ends on its own only when the model stops emitting tool calls, so every limit here
 * bounds tool calls or wall-clock.
 */
export interface AgentTurnBudget {
  /**
   * Tool calls after which every further call is refused with a tool error asking the model to
   * finish from what it has.
   * A model that complies ends the turn normally.
   */
  maxToolCalls: number;
  /**
   * Tool calls after which the turn is aborted as `budget_exhausted`.
   * The refusal above is only a message; a model that keeps calling through it would otherwise
   * loop on the refusal itself.
   */
  hardMaxToolCalls: number;
  /** Consecutive identical (tool, args) calls after which the call is refused. The result cannot differ. */
  maxRepeats: number;
  /** Wall-clock for the model's generation; host work after the reply is not counted. */
  maxDurationMs: number;
}

export type AgentTurnExecution =
  | { status: "done" }
  | { status: "aborted" }
  | { status: "awaiting_approval"; approval: ApprovalRequest }
  | { status: "error"; error: AgentTurnError };

/** The model that answered and what it charged. */
export interface AgentModelUsage {
  providerId: string;
  modelId: string;
  usage: Usage;
}

export interface AgentUsageReport extends AgentModelUsage {
  /** The runtime's own calls: turns, compactions and branch summaries. */
  source: (typeof AgentUsageSource)["Turn" | "Compaction" | "BranchSummary"];
  /** The tree entry that carries this usage; appended before the report is made. */
  entryId: string;
}

/**
 * Every provider call on a session's tree, once the entry carrying it has landed.
 * The host meters from here; the runtime never reads usage back.
 * Runs inside Pi's event subscription, so the host handles its own failures rather than letting
 * one surface as a turn error.
 */
export type AgentUsageListener = (
  report: AgentUsageReport
) => void | Promise<void>;
