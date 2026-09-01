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
 * The oRPC package owns session, durable-run and maintenance. The host supplies a typed
 * factory with kind definitions and credential handling.
 */

/** Where the caller stands against the usage quota right now; see `agent.usage.me`. */
export type AgentUsageStanding = agentContracts.AgentUsageStanding;

/**
 * Extends the resolved {@link Caller}: which tier a kind admits is the kind's registered
 * `minTier`. By the time a service sees this the guard has already enforced that floor.
 */
export interface AgentServiceContext extends ServiceContext {
  workflow: WorkflowControlClient;
}

export interface AgentServiceCaller extends AgentKindCaller {
  /** Session user who owns every session this call may touch. Always present: every kind requires a session-bearing tier. */
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
 * Mirrors `agentModelRefSchema` structurally so this package has no provider-SDK dependency.
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

  /** Enqueues a turn on the session's durable run and returns immediately. Consume via {@link AgentKindService.stream}. */
  prompt(
    caller: AgentServiceCaller,
    input: {
      sessionId: string;
      text: string;
      template?: { name: string; args?: string[] };
      preAuthorizeToolNames?: string[];
    }
  ): Promise<AgentStreamCursor & { startedRun: boolean }>;

  /** Cursor to the start of the turn currently executing, or `null` when none is running. */
  attach(
    caller: AgentServiceCaller,
    input: { sessionId: string }
  ): Promise<AgentStreamCursor | null>;

  /**
   * Returns an async generator so the oRPC handler can hand the iterator to
   * `asyncIteratorObject` without buffering.
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
   * Compacts the active branch and returns the rebuilt detail. `CONFLICT` while a turn runs,
   * an approval is undecided, or the branch has nothing to condense.
   */
  compact(
    caller: AgentServiceCaller,
    input: { sessionId: string; customInstructions?: string }
  ): Promise<agentContracts.AgentSessionDetail | null>;

  /**
   * Rewinds in place: the leaf moves to `entryId`. `CONFLICT` while a turn runs or an
   * approval is undecided.
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
   * Copies the session into a new one — the branch below `entryId` or the whole tree — with
   * kind state as it stands now. Same refusals as {@link navigate}.
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
   * Returns a human-readable reason when the pair is unusable, or `null` when it is fine.
   * A return value rather than a throw: the caller is middleware that turns this into
   * `BAD_REQUEST`, and the reason has to come from the kind's own policy.
   */
  validateModel(ref: AgentModelRef): Promise<string | null>;

  /**
   * Takes the caller because `requiresApiKey` depends on which provider keys they have
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
 * Eager so the guards refuse a caller below the floor before the definition is loaded.
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

export const availableAgentKinds = (context: BaseOSContext): string[] => [
  ...(context.agentFactory?.kinds ?? []),
];
