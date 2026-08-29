import type {
  AgentTool as PiAgentTool,
  AgentToolResult,
  AgentToolUpdateCallback,
  PromptTemplate,
  Skill,
  ThinkingLevel,
} from "@earendil-works/pi-agent-core";
import type { Usage } from "@earendil-works/pi-ai";
import type { Static, TSchema } from "typebox";

import type { OperatorDecision } from "./wire/operator-decision.ts";

export type { PromptTemplate, Skill, ThinkingLevel };

export type ToolTier = string;

/** Discriminates rows in `agent.session`, and selects the host service for a kind. */
export type AgentKind = string;

export interface AgentPolicy {
  tierOf: (toolName: string) => ToolTier;
  labelOf: (toolName: string) => string;
  requiresApproval: (tier: ToolTier) => boolean;
  changesState?: (tier: ToolTier) => boolean;
  summarize: <TResult>(
    toolName: string,
    result: TResult,
    isError: boolean
  ) => string;
  stateScope?: string;
}

/** Presentation policy shared by live Pi events and persisted transcript replay. */
export interface AgentEventPresentation {
  tierOf: (toolName: string) => ToolTier;
  labelOf: (toolName: string) => string;
  summarize: <TResult>(
    toolName: string,
    result: TResult,
    isError: boolean
  ) => string;
}

/**
 * A Pi tool whose `execute` also receives the turn's context — the ports and ids a kind resolves
 * once per turn. Bound to Pi's four-argument shape by `bindToolContext` before a turn runs.
 */
export type AgentTool<
  TContext extends object,
  TParameters extends TSchema = TSchema,
  TDetails = unknown,
> = Omit<PiAgentTool<TParameters, TDetails>, "execute"> & {
  execute(
    toolCallId: string,
    params: Static<TParameters>,
    signal: AbortSignal | undefined,
    onUpdate: AgentToolUpdateCallback<TDetails> | undefined,
    context: TContext
  ): Promise<AgentToolResult<TDetails>>;
};

/** A tool call the model issued, as the turn's hooks see it before execution. */
export interface ToolCallRequest {
  toolCallId: string;
  toolName: string;
  /** Validated arguments. */
  input: unknown;
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

/** What a new session starts with when its creator chose nothing; the kind's code values, possibly overridden by the operator's kind configuration. */
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
  label?: string;
}

export interface AgentNavigationResult {
  cancelled: boolean;
}

export interface AgentTurnMessage {
  text: string;
  template?: { name: string; args?: string[] };
  /**
   * The operator decision this turn relays, when the workflow synthesised it after an approval.
   * The turn then announces the decision on the wire before the model runs and marks its own
   * user message as not operator-typed.
   */
  decision?: OperatorDecision;
}

/**
 * Why a turn failed, coarse enough for a client to pick the next step: rotate a key, wait, compact
 * the session, or report a bug. Values are the closed vocabulary shared by the wire `error` event.
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
 * What one turn may consume before the runtime stops it. A turn ends on its own only when the
 * model stops emitting tool calls, so every limit here bounds tool calls or wall-clock; nothing
 * else can keep a turn alive.
 */
export interface AgentTurnBudget {
  /**
   * Tool calls after which every further call is refused with a tool error asking the model to
   * finish from what it has. A model that complies ends the turn normally.
   */
  maxToolCalls: number;
  /**
   * Tool calls after which the turn is aborted as `budget_exhausted`. The refusal above is only a
   * message; a model that keeps calling through it would otherwise loop on the refusal itself.
   */
  hardMaxToolCalls: number;
  /**
   * Consecutive calls of one tool with identical arguments after which the call is refused. The
   * result cannot differ, so the refusal tells the model as much.
   */
  maxRepeats: number;
  /** Wall-clock for the model's generation; host work after the reply is not counted. */
  maxDurationMs: number;
}

export interface AgentTurnExecution<TApproval> {
  status: "done" | "awaiting_approval" | "aborted" | "error";
  approvals: TApproval[];
  error?: AgentTurnError;
}

/** What the runtime made a provider call for. */
export type AgentUsageSource = "turn" | "compaction" | "branch_summary";

/** A provider call as billed: the model that answered and what it charged. */
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
 * Receives every provider call the runtime makes on a session's tree — the turn's replies,
 * compaction, branch summaries — once the entry carrying it has landed. The host meters from
 * here; the runtime never reads usage back. Runs inside Pi's event subscription, so the host
 * handles its own failures rather than letting one surface as a turn error.
 */
export type AgentUsageListener = (
  report: AgentUsageReport
) => void | Promise<void>;
