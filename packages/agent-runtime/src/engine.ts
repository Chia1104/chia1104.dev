import type {
  AgentSessionSettings,
  AgentWireEvent,
  ApprovalRequest,
  Session,
} from "@chia/agent-core";

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
 * `compact`, `compactIfNeeded` and `navigate` are optional engine capabilities. A normal turn only
 * relies on prompt, approval, pending-message, and lifecycle methods.
 */
export interface AgentEngineHandle {
  readonly approvalRequests: readonly ApprovalRequest[];
  prompt: (text: string) => Promise<void>;
  promptFromTemplate: (name: string, args?: string[]) => Promise<void>;
  compact?: (customInstructions?: string) => Promise<AgentCompactionResult>;
  /**
   * Compacts only under context pressure, and reports `null` when it decided not to.
   *
   * The threshold lives behind this method rather than in the runtime: estimating context tokens
   * needs the engine's own accounting (provider usage where available, a heuristic otherwise), and
   * a second copy of that arithmetic in the runtime would drift from it. The runtime asks
   * "compact if you must", never "how full are you".
   */
  compactIfNeeded?: () => Promise<AgentCompactionResult | null>;
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
  compactIfNeeded: () => Promise<AgentCompactionResult | null>;
  navigate: (
    entryId: string,
    options: AgentNavigationOptions
  ) => Promise<AgentNavigationResult>;
}

/**
 * What a maintenance engine needs, and nothing more.
 *
 * Compaction and branch navigation only walk the session tree and call the model with pi's own
 * summarisation prompts. Tools, skills, the agent system prompt and the approval gate are all
 * irrelevant to them, so they are deliberately absent here rather than being built and discarded.
 */
export interface AgentMaintenanceCreateOptions {
  agentSessionId: string;
  session: Session;
  settings: AgentSessionSettings;
}

/** An agent kind plus the engine factory that implements it. */
export interface AgentDefinition<
  TCreateOptions extends AgentEngineCreateOptions,
  THandle extends AgentEngineHandle = AgentEngineHandle,
> {
  kind: string;
  createEngine: (options: TCreateOptions) => Promise<THandle>;
  /**
   * Optional: a stripped-down handle for session-tree maintenance. Kinds that omit it simply have
   * no cheap maintenance path; the turn lifecycle never touches this.
   */
  createMaintenanceEngine?: (
    options: AgentMaintenanceCreateOptions
  ) => Promise<AgentMaintenanceEngineHandle>;
}
