import type {
  PromptTemplate,
  Skill,
  ThinkingLevel,
} from "@earendil-works/pi-agent-core";
import type { Usage } from "@earendil-works/pi-ai";

import type { OperatorDecision } from "./wire/operator-decision.ts";
import type { AgentAttachment } from "./wire/schema.ts";

export type { PromptTemplate, Skill, ThinkingLevel };

export type ToolTier = string;

/** Discriminates rows in `agent.session`, and selects the host service for a kind. */
export type AgentKind = string;

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
export type AgentErrorKind =
  | "auth"
  | "quota"
  | "rate_limited"
  | "context_overflow"
  | "budget_exhausted"
  | "provider"
  | "internal";

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

export type AgentUsageSource = "turn" | "compaction" | "branch_summary";

/** The model that answered and what it charged. */
export interface AgentModelUsage {
  providerId: string;
  modelId: string;
  usage: Usage;
}

export interface AgentUsageReport extends AgentModelUsage {
  source: AgentUsageSource;
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
