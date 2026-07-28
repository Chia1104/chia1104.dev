import type { AgentWireEvent, ApprovalRequest } from "@chia/agent-core";

/**
 * The engine-facing options every agent kind must accept.
 *
 * Provider-specific options belong to the kind's concrete create-options type. Keeping the common
 * fields here lets the runtime execute a turn without knowing whether pi, Vercel AI SDK, TanStack
 * AI, or another engine created the handle.
 */
export interface AgentEngineCreateOptions {
  agentSessionId: string;
  onEvent: (event: AgentWireEvent) => void;
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

/**
 * Runtime-neutral handle for one agent turn.
 *
 * `compact` and `navigate` are optional engine capabilities. A normal turn only relies on prompt,
 * approval, pending-message, and lifecycle methods.
 */
export interface AgentEngineHandle {
  readonly approvalRequests: readonly ApprovalRequest[];
  prompt: (text: string) => Promise<void>;
  promptFromTemplate: (name: string, args?: string[]) => Promise<void>;
  compact?: (customInstructions?: string) => Promise<AgentCompactionResult>;
  navigate?: (
    entryId: string,
    options: AgentNavigationOptions
  ) => Promise<AgentNavigationResult>;
  /** Drains the pending-message queue into the active engine. */
  drainPendingMessages: () => Promise<number>;
  /** Detaches subscriptions and releases engine-local resources. */
  dispose: () => void;
}

/** Engine handle for agent kinds that expose session-tree maintenance operations. */
export interface AgentMaintenanceEngineHandle extends AgentEngineHandle {
  compact: (customInstructions?: string) => Promise<AgentCompactionResult>;
  navigate: (
    entryId: string,
    options: AgentNavigationOptions
  ) => Promise<AgentNavigationResult>;
}

/** An agent kind plus the engine factory that implements it. */
export interface AgentDefinition<
  TCreateOptions extends AgentEngineCreateOptions,
  THandle extends AgentEngineHandle = AgentEngineHandle,
> {
  kind: string;
  createEngine: (options: TCreateOptions) => Promise<THandle>;
}
