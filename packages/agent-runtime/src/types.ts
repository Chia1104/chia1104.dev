import type {
  AgentHarnessTool,
  PromptTemplate,
  Skill,
  ThinkingLevel,
} from "@earendil-works/pi-agent-core";

import type { OperatorDecision } from "./wire/operator-decision.ts";

export type { PromptTemplate, Skill, ThinkingLevel };

export type ToolTier = string;

/** Discriminates rows in `agent_session`, and selects the host service for a kind. */
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

export type AgentTool<TContext extends object> = AgentHarnessTool<TContext>;

export interface AgentSessionSettings {
  providerId: string;
  modelId: string;
  thinkingLevel: ThinkingLevel;
  activeToolNames: string[] | null;
  autoApprove: ToolTier[];
}

export interface AgentSessionDefaults {
  providerId: string;
  modelId: string;
  thinkingLevel?: ThinkingLevel;
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
  | "provider"
  | "internal";

export interface AgentTurnError {
  kind: AgentErrorKind;
  message: string;
}

export interface AgentTurnExecution<TApproval> {
  status: "done" | "awaiting_approval" | "aborted" | "error";
  approvals: TApproval[];
  error?: AgentTurnError;
}
