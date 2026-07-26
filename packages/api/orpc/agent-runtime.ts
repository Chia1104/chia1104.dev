import type { AgentWireEvent } from "@chia/agent/events";
import type { ServiceContext } from "@chia/service-kit/context";

import type * as agentContracts from "./contracts/agent.contract";

/**
 * Registration seam for the agent runtime.
 *
 * The oRPC routes live here in `packages/api`, but *running* an agent needs a long-lived process
 * that owns harness construction, live-run bookkeeping and provider credentials — all of which
 * belong to the host app. So this module declares the port and `apps/service` registers an
 * implementation at module load, exactly like `registerFeedEventListeners` in `./events.ts`.
 *
 * Keeping the runtime out of the request context is deliberate: it is process-scoped state, not
 * per-request state, and `ServiceContext` is explicitly documented as free of domain ports.
 */

type Contracts = typeof agentContracts;
type Input<K extends keyof Contracts> = Contracts[K] extends {
  "~orpc": { inputSchema?: infer S };
}
  ? S extends { "~standard": { types?: { output: infer O } } }
    ? O
    : never
  : never;

/** Per-call context the runtime needs from the request that triggered it. */
export interface AgentRuntimeCaller {
  /** Configured admin, already verified by `adminGuard`. */
  adminId: string;
  /** Session user id, for the approval audit trail. */
  userId: string;
  context: ServiceContext;
}

export interface AgentRuntime {
  listSessions(
    caller: AgentRuntimeCaller,
    input: { limit?: number; includeDeleted?: boolean } | undefined
  ): Promise<{
    items: agentContracts.AgentSessionSummary[];
    nextCursor: string | number | null;
  }>;

  createSession(
    caller: AgentRuntimeCaller,
    input: {
      title?: string;
      targetFeedId?: number;
      modelId?: string;
      thinkingLevel?: string;
      autoApprove?: string[];
    }
  ): Promise<agentContracts.AgentSessionDetail>;

  getSession(
    caller: AgentRuntimeCaller,
    input: { sessionId: string }
  ): Promise<agentContracts.AgentSessionDetail | null>;

  deleteSession(
    caller: AgentRuntimeCaller,
    input: { sessionId: string }
  ): Promise<boolean>;

  updateSettings(
    caller: AgentRuntimeCaller,
    input: {
      sessionId: string;
      title?: string;
      modelId?: string;
      thinkingLevel?: string;
      activeToolNames?: string[] | null;
      autoApprove?: string[];
    }
  ): Promise<agentContracts.AgentSessionDetail | null>;

  /**
   * Enqueues a turn on the session's durable run and returns immediately. Output is consumed via
   * {@link AgentRuntime.stream}.
   */
  prompt(
    caller: AgentRuntimeCaller,
    input: {
      sessionId: string;
      text: string;
      template?: { name: string; args?: string[] };
      preAuthorizeToolNames?: string[];
    }
  ): Promise<{ runId: string; startIndex: number; startedRun: boolean }>;

  /**
   * Streams a run's durable event stream.
   *
   * Returning an async generator (rather than taking a callback) is what lets the oRPC handler hand
   * the iterator straight to `eventIterator` without buffering.
   */
  stream(
    caller: AgentRuntimeCaller,
    input: {
      sessionId: string;
      runId?: string;
      startIndex?: number;
      deltas?: boolean;
    }
  ): AsyncGenerator<AgentWireEvent, void, void>;

  abort(
    caller: AgentRuntimeCaller,
    input: { sessionId: string }
  ): Promise<boolean>;

  steer(
    caller: AgentRuntimeCaller,
    input: { sessionId: string; text: string; kind?: "steer" | "followUp" }
  ): Promise<boolean>;

  approve(
    caller: AgentRuntimeCaller,
    input: {
      sessionId: string;
      toolCallId: string;
      approved: boolean;
      comment?: string;
    }
  ): Promise<boolean>;

  compact(
    caller: AgentRuntimeCaller,
    input: { sessionId: string; customInstructions?: string }
  ): Promise<{ summary: string; tokensBefore: number } | null>;

  navigate(
    caller: AgentRuntimeCaller,
    input: {
      sessionId: string;
      entryId: string;
      summarize?: boolean;
      label?: string;
    }
  ): Promise<{ cancelled: boolean; events: AgentWireEvent[] } | null>;

  getDraft(
    caller: AgentRuntimeCaller,
    input: { sessionId: string }
  ): Promise<agentContracts.AgentDraftPayload | null>;

  listModels(): Promise<
    {
      providerId: string;
      modelId: string;
      name: string;
      contextWindow: number;
      supportsReasoning: boolean;
      supportsImageInput: boolean;
    }[]
  >;

  listCapabilities(): Promise<{
    tools: {
      name: string;
      label: string;
      tier: "read" | "draft" | "commit";
      description: string;
    }[];
    promptTemplates: { name: string; description?: string }[];
    skills: { name: string; description: string }[];
  }>;
}

let runtime: AgentRuntime | undefined;

export class AgentRuntimeNotRegisteredError extends Error {
  constructor() {
    super(
      "No agent runtime registered. The host app must call registerAgentRuntime() at startup — " +
        "see apps/service/src/services/agent-runtime.service.ts."
    );
    this.name = "AgentRuntimeNotRegisteredError";
  }
}

export const registerAgentRuntime = (implementation: AgentRuntime): void => {
  runtime = implementation;
};

export const getAgentRuntime = (): AgentRuntime => {
  if (!runtime) throw new AgentRuntimeNotRegisteredError();
  return runtime;
};

export const isAgentRuntimeRegistered = (): boolean => runtime !== undefined;

// `Input` is exported for the host app to derive handler argument types without restating them.
export type { Input as AgentContractInput };
