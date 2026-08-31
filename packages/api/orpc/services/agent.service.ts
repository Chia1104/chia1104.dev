import type {
  AgentKindCaller,
  AgentKindCapabilities,
} from "@chia/agent-host/kind";
import type { AgentWireEvent } from "@chia/agent-runtime/wire/schema";
import { toORPCError } from "@chia/service-kit/adapters/orpc";
import type { ServiceContext } from "@chia/service-kit/context";
import { AppError } from "@chia/service-kit/errors";
import type { CallerTier } from "@chia/service-kit/policies/caller.policy";
import type { JsonObject } from "@chia/utils/json";
import type { WorkflowControlClient } from "@chia/workflow-control/client";

import type * as agentContracts from "../contracts/agent.contract";
import type { BaseOSContext } from "../utils";

import type { AgentFactory } from "./agent.factory";

/**
 * Port for host-owned agent services.
 *
 * The oRPC package owns the session, durable-run and maintenance behavior. The host contributes a
 * typed factory with kind definitions and credential handling; no service registry is kept on the
 * request context.
 */

/** Where the caller stands against the usage quota right now; see `agent.usage.me`. */
export type AgentUsageStanding = agentContracts.AgentUsageStanding;

/**
 * Per-call context the service needs from the request that triggered it.
 *
 * Extends the resolved {@link Caller} rather than restating a role: which tier a kind admits is
 * the kind's own policy (the factory's registered `minTier`), so the transport passes what it
 * learned and lets the kind read `tier`, `session` or `adminId` as it needs. By the time a service
 * sees this the guard has already enforced the kind's minimum tier.
 */
export interface AgentServiceContext extends ServiceContext {
  workflow: WorkflowControlClient;
}

export interface AgentServiceCaller extends AgentKindCaller {
  /**
   * Session user who owns every session this call may touch. Always present: a session row has
   * an owner, so every kind requires at least a session-bearing tier.
   */
  userId: string;
  context: AgentServiceContext;
}

/** Where to start tailing a run: one index per durable stream, since each is numbered on its own. */
export interface AgentStreamCursor {
  runId: string;
  startIndex: number;
  deltaStartIndex: number;
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
  ): Promise<AgentStreamCursor & { startedRun: boolean }>;

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
      /** Merge token deltas from this index on; omitted means the coarse transcript only. */
      deltaStartIndex?: number;
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

  /**
   * Compacts the active branch and returns the detail rebuilt, the way {@link navigate} does.
   * Refused (`CONFLICT`) while a turn runs, while an approval is undecided, or when the branch
   * has nothing to condense.
   */
  compact(
    caller: AgentServiceCaller,
    input: { sessionId: string; customInstructions?: string }
  ): Promise<agentContracts.AgentSessionDetail | null>;

  /**
   * Rewinds the session in place: the leaf moves to `entryId` (a user message's parent, so it
   * can be re-asked) and the detail is returned rebuilt, because a changed branch invalidates
   * every view the client held. Refused (`CONFLICT`) while a turn runs or an approval is undecided.
   */
  navigate(
    caller: AgentServiceCaller,
    input: {
      sessionId: string;
      entryId: string;
      summarize?: boolean;
      label?: string;
    }
  ): Promise<agentContracts.AgentSessionDetail | null>;

  /**
   * Copies the session into a new one — the branch below `entryId` (`before` a user message so
   * it can be re-asked, or `at` any entry) or the whole tree — along with the kind's state as it
   * stands now. Returns the new session's detail. Same refusals as {@link navigate}.
   */
  fork(
    caller: AgentServiceCaller,
    input: {
      sessionId: string;
      entryId?: string;
      position?: "before" | "at";
      title?: string;
    }
  ): Promise<agentContracts.AgentSessionDetail | null>;

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

  listCapabilities(): Promise<AgentKindCapabilities>;
}

/** The request's factory, or `SERVICE_UNAVAILABLE` when this process has no agent host. */
export const requireAgentFactory = (context: BaseOSContext): AgentFactory => {
  if (!context.agentFactory) {
    throw toORPCError(
      new AppError("SERVICE_UNAVAILABLE", {
        message: "Agents are not available in this process.",
      })
    );
  }
  return context.agentFactory;
};

/**
 * The registered tier floor for `kind`, or `SERVICE_UNAVAILABLE` when the factory has none.
 * Eager on purpose: the guards refuse a caller below the floor before the definition — and the
 * domain package behind it — is ever loaded.
 */
export const requireAgentKindTier = (
  context: BaseOSContext,
  kind: string
): CallerTier => {
  const minTier = requireAgentFactory(context).minTierOf(kind);
  if (minTier === undefined) {
    throw toORPCError(
      new AppError("SERVICE_UNAVAILABLE", {
        message: `Agent kind "${kind}" is not available in this process.`,
      })
    );
  }
  return minTier;
};

/** A freshly composed service for `kind`, or `SERVICE_UNAVAILABLE` when the factory has none. */
export const requireAgentKind = async (
  context: BaseOSContext,
  kind: string
): Promise<AgentKindService> => {
  const service = await requireAgentFactory(context).create(kind);
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
export const availableAgentKinds = (context: BaseOSContext): string[] => [
  ...(context.agentFactory?.kinds ?? []),
];
