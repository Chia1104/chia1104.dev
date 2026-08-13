import type { AgentWireEvent } from "@chia/agent-runtime/events";
import type { ServiceContext } from "@chia/service-kit/context";

import type * as agentContracts from "./contracts/agent.contract";

/**
 * Registration seam for host-owned agent services.
 *
 * The oRPC routes live here in `packages/api`, but *running* an agent needs a long-lived process
 * that owns harness construction, live-run bookkeeping and provider credentials — all of which
 * belong to the host app. So this module declares the port and `apps/service` registers an
 * implementation at module load, exactly like `registerFeedEventListeners` in `./events.ts`.
 *
 * Keeping the service out of the request context is deliberate: it is process-scoped state, not
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

/** Per-call context the service needs from the request that triggered it. */
export interface AgentServiceCaller {
  /** Configured admin, already verified by `adminGuard`. */
  adminId: string;
  /** Session user id, for the approval audit trail. */
  userId: string;
  context: ServiceContext;
}

export interface AgentStreamCursor {
  runId: string;
  startIndex: number;
}

/**
 * Model identity, mirroring `agentModelRefSchema`.
 *
 * Restated structurally rather than importing the concrete Pi session so this package keeps no
 * dependency on a provider SDK — the port is a contract, not an implementation.
 */
export interface AgentModelRef {
  providerId: string;
  modelId: string;
}

export interface AgentKindService {
  listSessions(
    caller: AgentServiceCaller,
    input: { limit?: number; includeDeleted?: boolean } | undefined
  ): Promise<{
    items: agentContracts.AgentSessionSummary[];
    nextCursor: string | number | null;
  }>;

  createSession(
    caller: AgentServiceCaller,
    input: {
      title?: string;
      targetFeedId?: number;
      model?: AgentModelRef;
      thinkingLevel?: string;
      autoApprove?: string[];
      runtimeConfig?: Record<string, unknown>;
    }
  ): Promise<agentContracts.AgentSessionDetail>;

  getSession(
    caller: AgentServiceCaller,
    input: { sessionId: string }
  ): Promise<agentContracts.AgentSessionDetail | null>;

  deleteSession(
    caller: AgentServiceCaller,
    input: { sessionId: string }
  ): Promise<boolean>;

  updateSettings(
    caller: AgentServiceCaller,
    input: {
      sessionId: string;
      title?: string;
      model?: AgentModelRef;
      thinkingLevel?: string;
      activeToolNames?: string[] | null;
      autoApprove?: string[];
      runtimeConfig?: Record<string, unknown>;
    }
  ): Promise<agentContracts.AgentSessionDetail | null>;

  /**
   * Enqueues a turn on the session's durable run and returns immediately. Output is consumed via
   * {@link AgentKindService.stream}.
   */
  prompt(
    caller: AgentServiceCaller,
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
    caller: AgentServiceCaller,
    input: {
      sessionId: string;
      runId?: string;
      startIndex?: number;
      deltas?: boolean;
    }
  ): AsyncGenerator<AgentWireEvent, void, void>;

  abort(
    caller: AgentServiceCaller,
    input: { sessionId: string }
  ): Promise<boolean>;

  steer(
    caller: AgentServiceCaller,
    input: { sessionId: string; text: string; queue?: "steer" | "followUp" }
  ): Promise<boolean>;

  approve(
    caller: AgentServiceCaller,
    input: {
      sessionId: string;
      toolCallId: string;
      approved: boolean;
      comment?: string;
    }
  ): Promise<AgentStreamCursor | null>;

  compact(
    caller: AgentServiceCaller,
    input: { sessionId: string; customInstructions?: string }
  ): Promise<{ summary: string; tokensBefore: number } | null>;

  navigate(
    caller: AgentServiceCaller,
    input: {
      sessionId: string;
      entryId: string;
      summarize?: boolean;
      label?: string;
    }
  ): Promise<{ cancelled: boolean; events: AgentWireEvent[] } | null>;

  /** Optional writing-domain extension retained for the current dashboard. */
  getDraft?(
    caller: AgentServiceCaller,
    input: { sessionId: string }
  ): Promise<agentContracts.AgentDraftPayload | null>;

  /**
   * Checks a model selection before anything persists it.
   *
   * Returns a human-readable reason when the pair is unusable, or `null` when it is fine. A return
   * value rather than a thrown error, because the caller is a middleware that has to turn this into
   * a `BAD_REQUEST` — and because which models a kind admits is the kind's own policy, so the
   * *reason* has to come from here rather than be reconstructed at the transport.
   */
  validateModel(ref: AgentModelRef): Promise<string | null>;

  /**
   * Takes the caller because `requiresApiKey` depends on which provider keys *they* have
   * registered. The catalogue itself is caller-independent.
   */
  listModels(caller: AgentServiceCaller): Promise<
    {
      providerId: string;
      modelId: string;
      name: string;
      contextWindow: number;
      supportsReasoning: boolean;
      supportsImageInput: boolean;
      requiresApiKey: boolean;
    }[]
  >;

  listCapabilities(): Promise<{
    tools: {
      name: string;
      label: string;
      tier: string;
      description: string;
    }[];
    promptTemplates: { name: string; description?: string }[];
    skills: { name: string; description: string }[];
  }>;
}

/**
 * Registry keyed by `agent_session.kind`.
 *
 * A single slot would have been overwritten by the second agent kind registered in the same
 * process — the two would silently share one implementation. Keying by kind is what makes a
 * sibling package like `@chia/agent-writing` additive.
 */
const services = new Map<string, AgentKindService>();

export class AgentKindServiceNotRegisteredError extends Error {
  constructor(kind: string) {
    super(
      `No agent service registered for kind "${kind}". The host app must call ` +
        "registerAgentKindService(kind, impl) at startup — see " +
        "apps/service/src/services/agent.service.ts."
    );
    this.name = "AgentKindServiceNotRegisteredError";
  }
}

export const registerAgentKindService = (
  kind: string,
  implementation: AgentKindService
): void => {
  services.set(kind, implementation);
};

export const getAgentKindService = (kind: string): AgentKindService => {
  const service = services.get(kind);
  if (!service) throw new AgentKindServiceNotRegisteredError(kind);
  return service;
};

export const isAgentKindServiceRegistered = (kind: string): boolean =>
  services.has(kind);

/** Kinds with a registered host service. */
export const registeredAgentKinds = (): string[] => [...services.keys()];

/**
 * Resolves the host service for a request.
 *
 * Creation and capability requests must provide `kind`. Session-scoped requests should instead
 * load the session and call {@link getAgentKindService} with the stored kind.
 */
export const resolveAgentKindService = (kind?: string): AgentKindService => {
  if (kind) return getAgentKindService(kind);
  if (services.size === 1) return [...services.values()][0]!;
  if (services.size === 0)
    throw new AgentKindServiceNotRegisteredError("(none)");
  throw new Error(
    `Multiple agent kinds are registered (${[...services.keys()].join(", ")}); ` +
      "the request must name one."
  );
};

// `Input` is exported for the host app to derive handler argument types without restating them.
export type { Input as AgentContractInput };
