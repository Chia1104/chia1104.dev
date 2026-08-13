import type {
  AgentHarnessTool,
  PromptTemplate,
  Skill,
  ThinkingLevel,
} from "@earendil-works/pi-agent-core";

export type { PromptTemplate, Skill, ThinkingLevel };

export type ToolTier = string;

/** Discriminates rows in `agent_session`, and selects the host service for a kind. */
export type AgentKind = string;

export interface AgentPolicy {
  tierOf: (toolName: string) => ToolTier;
  labelOf: (toolName: string) => string;
  requiresApproval: (tier: ToolTier) => boolean;
  changesState?: (tier: ToolTier) => boolean;
  summarize: (toolName: string, result: unknown, isError: boolean) => string;
  stateScope?: string;
}

/** Presentation policy shared by live Pi events and persisted transcript replay. */
export interface AgentEventPresentation {
  tierOf: (toolName: string) => ToolTier;
  labelOf: (toolName: string) => string;
  summarize: (toolName: string, result: unknown, isError: boolean) => string;
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
}

export interface AgentTurnExecution<TApproval> {
  status: "done" | "awaiting_approval" | "error";
  approvals: TApproval[];
  error?: string;
}
