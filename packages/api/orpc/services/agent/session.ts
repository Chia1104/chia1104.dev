import { loadKindConfig } from "@chia/agent-host/config";
import { readAgentTurnMarker } from "@chia/agent-host/execution";
import type { AgentKindDefinition } from "@chia/agent-host/kind";
import { canCompactBranch } from "@chia/agent-runtime/pi/compaction";
import {
  computeSessionStats,
  entriesUpToSeq,
} from "@chia/agent-runtime/session/entries";
import {
  PgSessionRepo,
  writeSessionSettings,
} from "@chia/agent-runtime/session/pg-repo";
import { walkBranch, walkTranscript } from "@chia/agent-runtime/session/tree";
import { estimateBranchContextTokens } from "@chia/agent-runtime/session/usage";
import type {
  AgentSessionDefaults,
  AgentSessionSettings,
  ThinkingLevel,
  ToolTier,
} from "@chia/agent-runtime/types";
import { entriesToWireEvents } from "@chia/agent-runtime/wire/replay";
import type { DB } from "@chia/db/client";
import {
  completeAgentRun,
  deleteAgentSession,
  getActiveAgentRun,
  getAgentApprovals,
  getAgentSession,
  softDeleteAgentSession,
} from "@chia/db/repos/agent";

import type { AgentServiceHost } from "../agent.factory";
import type { AgentKindService, AgentServiceCaller } from "../agent.service";

import { readAgentAbortControllerRef } from "./abort";
import { cancelLiveAgentRun } from "./run-control";
import { isRunLive, runStateOf } from "./run-liveness";

type SessionService = Pick<
  AgentKindService,
  | "listSessions"
  | "createSession"
  | "getSession"
  | "deleteSession"
  | "updateSettings"
>;

/** Session persistence, ownership checks and transport projections for one agent kind. */
export const createAgentSessionOperations = <TState, TConfig extends object>(
  definition: AgentKindDefinition<TState, TConfig>,
  host: AgentServiceHost
) => {
  /** `defaults` only matter to `create`; the code values serve every other operation. */
  const repoFor = (
    db: DB,
    defaults: AgentSessionDefaults = definition.defaults
  ) => new PgSessionRepo(db, { kind: definition.kind, defaults });

  /** Loads a non-deleted session and kind state after checking caller ownership and kind. */
  const loadOwnedRow = async (
    caller: AgentServiceCaller,
    sessionId: string
  ) => {
    const db = caller.context.db;
    const row = await getAgentSession(db, sessionId);
    if (!row || row.deletedAt !== null) return null;
    if (row.userId !== caller.userId || row.kind !== definition.kind)
      return null;

    const state = await definition.state.load(db, sessionId);
    return state === null ? null : { ...row, state };
  };

  /** Adds the session's active durable run to an owned row. */
  const loadOwnedSession = async (
    caller: AgentServiceCaller,
    sessionId: string
  ) => {
    const row = await loadOwnedRow(caller, sessionId);
    if (!row) return null;

    const activeRun = await getActiveAgentRun(caller.context.db, sessionId);
    return {
      ...row,
      activeRunId: activeRun?.id ?? null,
      workflowRunId: activeRun?.externalRunId ?? null,
      startedAt: activeRun?.startedAt ?? null,
      turn: activeRun ? readAgentTurnMarker(activeRun.metadata) : undefined,
      abortController: activeRun
        ? readAgentAbortControllerRef(activeRun.metadata)
        : undefined,
    };
  };

  /** Rebinds a caller to the transaction holding the session lock. */
  const withDb = (caller: AgentServiceCaller, db: DB): AgentServiceCaller => ({
    ...caller,
    context: { ...caller.context, db },
  });

  const settingsOf = (row: {
    id: string;
    providerId: string | null;
    modelId: string | null;
    thinkingLevel: string | null;
    activeToolNames: string[] | null;
    autoApprove: string[];
  }): AgentSessionSettings => {
    if (!row.providerId || !row.modelId || !row.thinkingLevel) {
      throw new Error(`Agent session ${row.id} has incomplete LLM settings.`);
    }
    return {
      providerId: row.providerId,
      modelId: row.modelId,
      thinkingLevel:
        /* SAFETY: persisted settings are validated before they are written. */ row.thinkingLevel as ThinkingLevel,
      activeToolNames: row.activeToolNames,
      autoApprove: row.autoApprove,
    };
  };

  const summaryOf = (
    row: NonNullable<Awaited<ReturnType<typeof loadOwnedRow>>>
  ) => {
    const settings = settingsOf(row);
    return {
      id: row.id,
      title: row.title,
      kind: row.kind,
      modelId: settings.modelId,
      thinkingLevel: settings.thinkingLevel,
      ...definition.state.summary(row.state),
      forkedFromSessionId: row.forkedFromSessionId,
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
    };
  };

  /** Tool approvals which still block a prompt or a tree mutation. */
  const undecidedApprovals = async (
    db: DB,
    sessionId: string
  ): Promise<string[]> => {
    const approvals = await getAgentApprovals(db, sessionId);
    return approvals
      .filter((approval) => approval.decidedAt === null)
      .map((approval) => approval.toolName);
  };

  const replayOptions = {
    tierOf: definition.policy.tierOf,
    labelOf: definition.policy.labelOf,
    summarize: definition.policy.summarize,
  };

  const detailFor = async (caller: AgentServiceCaller, sessionId: string) => {
    const row = await loadOwnedSession(caller, sessionId);
    if (!row) return null;

    const db = caller.context.db;
    const session = await repoFor(db).openById(sessionId);

    // A lock transaction uses one connection, so these reads stay sequential.
    const entries = await session.getEntries();
    const leafId = await session.getLeafId();
    const branch = walkBranch(entries, leafId);
    const transcript = walkTranscript(entries, leafId);
    const stats = computeSessionStats(entries);
    const kindDetail = await definition.state.detail(db, sessionId, row.state);
    const approvals = await getAgentApprovals(db, sessionId);

    // Read the marker after the branch so a turn which just finished is not cut out of both sources.
    const activeRun = await getActiveAgentRun(db, sessionId);
    const turn = activeRun
      ? readAgentTurnMarker(activeRun.metadata)
      : undefined;
    const run = await runStateOf(host.runs, {
      activeRunId: activeRun?.id ?? null,
      workflowRunId: activeRun?.externalRunId ?? null,
      startedAt: activeRun?.startedAt ?? null,
      turn,
    });

    // A running turn is replayed from its stream; the transcript stops at the marker's sequence.
    const transcriptEntries =
      run?.status === "running" && turn
        ? entriesUpToSeq(transcript, turn.seqBefore)
        : transcript;
    const contextEntries =
      run?.status === "running" && turn
        ? entriesUpToSeq(branch, turn.seqBefore)
        : branch;

    return {
      session: summaryOf(row),
      settings: settingsOf(row),
      runtimeConfig: row.runtimeConfig,
      configVersion: row.configVersion,
      ...kindDetail,
      run,
      events: entriesToWireEvents(transcriptEntries, replayOptions),
      approvals: approvals.map((approval) => ({
        toolCallId: approval.toolCallId,
        toolName: approval.toolName,
        args: approval.args ?? undefined,
        status: approval.status,
        comment: approval.comment ?? undefined,
      })),
      stats: {
        messageCount: stats.messageCount,
        contextTokens: estimateBranchContextTokens(contextEntries),
        compactable: canCompactBranch(contextEntries),
        totalTokens: stats.totalTokens,
        costTotal: stats.costTotal,
      },
    };
  };

  const service: SessionService = {
    async listSessions(caller, input) {
      const metadata = await repoFor(caller.context.db).list({
        userId: caller.userId,
        limit: input?.limit,
        includeDeleted: input?.includeDeleted,
      });
      const rows = await Promise.all(
        metadata.map((entry) => loadOwnedRow(caller, entry.id))
      );
      return {
        items: rows.flatMap((row) => (row ? [summaryOf(row)] : [])),
        nextCursor: null,
      };
    },

    async createSession(caller, input) {
      const db = caller.context.db;
      const { defaults } = await loadKindConfig(db, definition);
      const session = await repoFor(db, defaults).create({
        userId: caller.userId,
        title: input.title,
        settings: {
          providerId: input.model?.providerId,
          modelId: input.model?.modelId,
          thinkingLevel:
            /* SAFETY: the route validates this setting before persistence. */ input.thinkingLevel as
              | ThinkingLevel
              | undefined,
          autoApprove:
            /* SAFETY: the route validates these tiers before persistence. */ input.autoApprove as
              | ToolTier[]
              | undefined,
        },
        runtimeConfig: input.runtimeConfig,
      });
      try {
        await definition.state.create(caller, db, session.id, input);
        const detail = await detailFor(caller, session.id);
        if (!detail)
          throw new Error("Session vanished immediately after creation");
        return detail;
      } catch (error) {
        await deleteAgentSession(db, session.id);
        throw error;
      }
    },

    getSession(caller, input) {
      return detailFor(caller, input.sessionId);
    },

    async deleteSession(caller, input) {
      const row = await loadOwnedSession(caller, input.sessionId);
      if (!row) return false;

      if (
        row.workflowRunId &&
        (await isRunLive(host.runs, row.workflowRunId))
      ) {
        await cancelLiveAgentRun(
          host.runs,
          caller.context.workflow,
          row.workflowRunId
        );
      }
      if (row.activeRunId) {
        await completeAgentRun(caller.context.db, row.activeRunId, "cancelled");
      }
      await softDeleteAgentSession(caller.context.db, input.sessionId);
      return true;
    },

    async updateSettings(caller, input) {
      const row = await loadOwnedSession(caller, input.sessionId);
      if (!row) return null;
      await writeSessionSettings(caller.context.db, input.sessionId, {
        title: input.title,
        providerId: input.model?.providerId,
        modelId: input.model?.modelId,
        thinkingLevel:
          /* SAFETY: the route validates this setting before persistence. */ input.thinkingLevel as
            | ThinkingLevel
            | undefined,
        activeToolNames: input.activeToolNames,
        autoApprove:
          /* SAFETY: the route validates these tiers before persistence. */ input.autoApprove as
            | ToolTier[]
            | undefined,
        runtimeConfig: input.runtimeConfig,
      });
      return detailFor(caller, input.sessionId);
    },
  };

  return {
    service,
    repoFor,
    loadOwnedRow,
    loadOwnedSession,
    withDb,
    settingsOf,
    detailFor,
    undecidedApprovals,
  };
};

export type AgentSessionOperations<TState, TConfig extends object> = ReturnType<
  typeof createAgentSessionOperations<TState, TConfig>
>;
