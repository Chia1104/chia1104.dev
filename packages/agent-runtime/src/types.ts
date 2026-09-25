import type { Usage } from "@earendil-works/pi-ai";

import type { AgentUsageSource } from "@chia/db/schema";
import type { JsonValue } from "@chia/utils/json";

import type { AgentAttachment } from "./wire/schema.ts";

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
  /** One transcript line for a call that succeeded, from the `details` it persisted. */
  summarize: (toolName: string, details: JsonValue | undefined) => string;
}

/** Presentation policy shared by live events and persisted transcript replay. */
export type AgentEventPresentation = Pick<
  AgentPolicy,
  "toolInfo" | "summarize"
>;

/** A tool call as the turn's checks see it before execution. */
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
  /**
   * The kind's identity for the call: the tool, its target and the state the operator is shown.
   * Recorded with the request; a kind reads its own pins back from it when the call runs.
   */
  key: string;
}

/**
 * A gated call the turn answered itself: approved because the session pre-approved its tier, or
 * refused by the turn's own checks with `reason`.
 */
export interface SettledCall {
  toolCallId: string;
  toolName: string;
  args: unknown;
  key: string;
  approved: boolean;
  reason?: string;
}

/**
 * The gated calls a turn stopped on. The operator answers `requests`; `settled` calls ride along,
 * because the batch resumes only once every call in it is answered.
 */
export interface ApprovalBatch {
  requests: ApprovalRequest[];
  settled: SettledCall[];
}

/** Refuses a call. The reason returns to the model as the tool's error result. */
export interface ToolCallRefusal {
  reason: string;
}

/**
 * How a gated call was answered: approved by the operator or the session's pre-approved tiers,
 * declined by the operator, or refused by the turn's own checks before the operator saw it.
 */
export const ApprovalVerdict = {
  Approved: "approved",
  Declined: "declined",
  Refused: "refused",
} as const;

export type ApprovalVerdict =
  (typeof ApprovalVerdict)[keyof typeof ApprovalVerdict];

/** The answer to one gated call. */
export interface ApprovalDecision {
  toolCallId: string;
  verdict: ApprovalVerdict;
  /** The operator's words, or the check's reason when `refused`. */
  comment?: string;
}

/**
 * Continues a turn that stopped on gated calls. Every call the stopped turn left waiting is
 * answered at once: approved calls run exactly as requested and the model reads a refusal for
 * the rest.
 */
export interface AgentTurnResume {
  /** The agent run whose turn stopped on the calls. */
  interruptedRunId: string;
  decisions: ApprovalDecision[];
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
  | { status: "awaiting_approval"; approvals: ApprovalRequest[] }
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
