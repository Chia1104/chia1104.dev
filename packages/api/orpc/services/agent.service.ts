import type { AgentWireEvent } from "@chia/agent-runtime/events";
import type { JsonObject } from "@chia/db/json";
import { toORPCError } from "@chia/service-kit/adapters/orpc";
import type { ServiceContext } from "@chia/service-kit/context";
import { AppError } from "@chia/service-kit/errors";
import type { Caller, CallerTier } from "@chia/service-kit/policies";

import type * as agentContracts from "../contracts/agent.contract";
import type { BaseOSContext } from "../utils";

/**
 * Port for host-owned agent services.
 *
 * The oRPC routes live here in `packages/api`, but *running* an agent needs a long-lived process
 * that owns harness construction, live-run bookkeeping and provider credentials — all of which
 * belong to the host app. The host supplies one implementation per `agent_session.kind` on the
 * request context (`BaseOSContext.agentKinds`); keying by kind is what lets a second agent
 * package be additive rather than replace the first.
 */

/**
 * Per-call context the service needs from the request that triggered it.
 *
 * Extends the resolved {@link Caller} rather than restating a role: which tier a kind admits is
 * the kind's own policy ({@link AgentKindService.minTier}), so the transport passes what it
 * learned and lets the kind read `tier`, `session` or `adminId` as it needs. By the time a service
 * sees this the guard has already enforced the kind's minimum tier.
 */
export interface AgentServiceCaller extends Caller {
  /**
   * Session user who owns every session this call may touch. Always present: a session row has
   * an owner, so every kind requires at least a session-bearing tier.
   */
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
  /**
   * Lowest {@link CallerTier} allowed to touch this kind at all — creation, listing and every
   * session-scoped route. Never below `Session`: sessions are owned by a user, so an anonymous or
   * API-key caller has no owner to be.
   */
  readonly minTier: CallerTier;

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
      runtimeConfig?: JsonObject;
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
      runtimeConfig?: JsonObject;
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
   * Cursor to the start of the turn currently executing, or `null` when no turn is running. Reads
   * only; the caller then tails `stream` from it.
   */
  attach(
    caller: AgentServiceCaller,
    input: { sessionId: string }
  ): Promise<AgentStreamCursor | null>;

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

/** The context's service for `kind`, or `SERVICE_UNAVAILABLE` when this process has none. */
export const requireAgentKind = (
  context: BaseOSContext,
  kind: string
): AgentKindService => {
  const service = context.agentKinds?.[kind];
  if (!service) {
    throw toORPCError(
      new AppError("SERVICE_UNAVAILABLE", {
        message: `Agent kind "${kind}" is not available in this process.`,
      })
    );
  }
  return service;
};

/** Kinds this process can serve. */
export const availableAgentKinds = (context: BaseOSContext): string[] =>
  Object.keys(context.agentKinds ?? {});
