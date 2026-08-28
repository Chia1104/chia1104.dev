import { getHookByToken, getRun } from "workflow/api";

import { loadKindConfig } from "@chia/agent-host/config";
import {
  AGENT_DELTA_NAMESPACE,
  AGENT_TURN_KEY,
  readAgentTurnMarker,
} from "@chia/agent-host/execution";
import type {
  AgentStreamPosition,
  AgentTurnMarker,
} from "@chia/agent-host/execution";
import type { AgentKindDefinition } from "@chia/agent-host/kind";
import { AGENT_TASK_IDS, resolveAgentTask } from "@chia/agent-host/tasks";
import {
  BYOK_PROVIDER_IDS,
  createAgentModels,
  UnknownAgentModelError,
} from "@chia/agent-runtime/models";
import {
  compactPiSession,
  navigatePiSession,
} from "@chia/agent-runtime/pi/maintenance";
import { entriesUpToSeq } from "@chia/agent-runtime/session/entries";
import type { SessionEntry } from "@chia/agent-runtime/session/entries";
import {
  PgSessionRepo,
  writeSessionSettings,
} from "@chia/agent-runtime/session/pg-repo";
import type { SessionTree } from "@chia/agent-runtime/session/tree";
import { estimateBranchContextTokens } from "@chia/agent-runtime/session/usage";
import type {
  AgentNavigationOptions,
  AgentSessionDefaults,
  AgentSessionSettings,
  ThinkingLevel,
  ToolTier,
} from "@chia/agent-runtime/types";
import { entriesToWireEvents } from "@chia/agent-runtime/wire/replay";
import type { AgentWireEvent } from "@chia/agent-runtime/wire/schema";
import type {
  AgentKindService,
  AgentServiceCaller,
  AgentStreamCursor,
} from "@chia/api/orpc/services/agent.service";
import type { DB } from "@chia/db/client";
import {
  bindAgentRunExternalId,
  completeAgentRun,
  createAgentRun,
  decideAgentApproval,
  deleteAgentSession,
  getActiveAgentRun,
  getAgentApprovals,
  getAgentSession,
  getAgentSessionLastSeq,
  patchAgentRunMetadata,
  softDeleteAgentSession,
  withAgentSessionLock,
} from "@chia/db/repos/agent";
import { AppError } from "@chia/service-kit/errors";
import {
  AGENT_END_SENTINEL,
  agentMessageToken,
} from "@chia/workflow-control/agent-hooks";

import { workflowControl } from "../repos/workflow-control.repo";
import {
  AGENT_ABORT_CONTROLLER_KEY,
  readAgentAbortControllerRef,
  signalAgentAbort,
  startAgentAbortController,
} from "../services/agent-abort-controller.service";
import {
  decryptAgentCredentials,
  readEncryptedAgentCredentials,
} from "../services/agent-credentials.service";

/**
 * The `AgentKindService` for one registered kind.
 *
 * Pi execution, session persistence, approval and wire primitives are `@chia/agent-runtime`; the
 * kind's tools, prompts and state are its {@link AgentKindDefinition}. This module is the
 * transport-facing glue between them and the durable workflow run, and it is the same for every
 * kind — nothing here knows what the kind does with a turn.
 *
 * **Stateless.** There is no in-process registry: each session is driven by a durable workflow run,
 * and every piece of state lives somewhere durable —
 *
 * - transcript → `agent.session_entry` (queried directly by the dashboard, and the source pi
 *   rebuilds context from)
 * - kind state → the kind's own tables, behind `definition.state`
 * - approval decisions → `agent.tool_approval`
 * - turn execution metadata → `agent.run`; pauses and event stream → the workflow backend
 *
 * That split is why a deploy mid-turn is survivable and why an approval can be granted a day later.
 * API instances can replicate because queue mutations cross `WorkflowControl` to the single
 * workflow process; no mutable conversation state lives in this process.
 */
export const createAgentKindService = <TState, TConfig extends object>(
  definition: AgentKindDefinition<TState, TConfig>
): AgentKindService => {
  // ============================================
  // Helpers
  // ============================================
  /** `defaults` only matter to `create`; the code's values are fine for every other operation. */
  const repoFor = (
    db: DB,
    defaults: AgentSessionDefaults = definition.defaults
  ) => new PgSessionRepo(db, { kind: definition.kind, defaults });

  /**
   * Loads a session row and its kind state **scoped to the caller**.
   *
   * The session id arrives from client input, so ownership is re-checked here rather than trusted —
   * the guard proves who is calling, not what they may open.
   */
  const loadOwnedRow = async (
    caller: AgentServiceCaller,
    sessionId: string
  ) => {
    const db = caller.context.db;
    const row = await getAgentSession(db, sessionId);
    if (!row || row.deletedAt !== null) return null;
    if (row.userId !== caller.userId) return null;
    if (row.kind !== definition.kind) return null;

    const state = await definition.state.load(db, sessionId);
    if (state === null) return null;

    return { ...row, state };
  };

  type OwnedRow = NonNullable<Awaited<ReturnType<typeof loadOwnedRow>>>;

  /** {@link loadOwnedRow} plus the session's active durable run, for everything that acts on it. */
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

  type OwnedSession = NonNullable<Awaited<ReturnType<typeof loadOwnedSession>>>;

  /**
   * The caller with its database handle swapped for the lock's transaction, so everything an
   * operation does under `withAgentSessionLock` runs on the lock's own connection.
   */
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
        /* SAFETY: The producer contract guarantees this value satisfies ThinkingLevel. */ row.thinkingLevel as ThinkingLevel,
      activeToolNames: row.activeToolNames,
      autoApprove:
        /* SAFETY: The producer contract guarantees this value satisfies ToolTier[]. */ row.autoApprove as ToolTier[],
    };
  };

  const summaryOf = (row: OwnedRow) => {
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

  /** Per-request `Models`, carrying whatever provider keys the caller has registered. */
  const modelsFor = (caller: AgentServiceCaller) =>
    createAgentModels(
      decryptAgentCredentials(
        readEncryptedAgentCredentials(caller.context.headers)
      )
    );

  /**
   * Maintenance operations over the session tree.
   *
   * These only walk the tree, so no tools, ports, approval gate or event subscriptions are
   * built — just the session, its settings and a model. Which model is the compaction or
   * branch-summary *task*'s to say: by default the session's own, which a BYOK session needs
   * its key for here just as much as in a turn (this path runs inside the request, so the
   * cookie is read and decrypted directly rather than travelling through the workflow); pinned
   * by the operator, a house model that needs no key at all. The session model is resolved
   * only when the task follows it.
   */
  const maintenanceFor = async (caller: AgentServiceCaller, row: OwnedRow) => {
    const db = caller.context.db;
    const session = await repoFor(db).openById(row.id);
    const settings = settingsOf(row);
    const models = modelsFor(caller);
    const operationFor = async (taskId: string) => {
      const task = await resolveAgentTask(db, taskId, {
        session: () => ({
          model: definition.models.resolve(settings, models),
          models,
        }),
      });
      return { session, settings, model: task.model, models: task.models };
    };
    return {
      session,
      compact: async (customInstructions?: string) =>
        compactPiSession(
          await operationFor(AGENT_TASK_IDS.sessionCompaction),
          customInstructions
        ),
      navigate: async (entryId: string, options: AgentNavigationOptions) =>
        navigatePiSession(
          await operationFor(AGENT_TASK_IDS.sessionBranchSummary),
          entryId,
          options
        ),
    };
  };

  const replayOptions = {
    tierOf: definition.policy.tierOf,
    labelOf: definition.policy.labelOf,
    summarize: definition.policy.summarize,
  };

  /**
   * A promise that never settles, used to drop an exhausted reader out of the two-stream race in
   * `stream` without it winning again.
   */
  const NEVER = new Promise<never>(() => undefined);

  /** Run states in which the session's workflow run can still accept a message. */
  const isRunLive = async (runId: string): Promise<boolean> => {
    try {
      const run = getRun(runId);
      if (!(await run.exists)) return false;
      const status = await run.status;
      return status === "pending" || status === "running";
    } catch {
      // A run from a previous deployment may no longer resolve; treat it as gone.
      return false;
    }
  };

  /** The active `agent.run` row as every state question reads it. */
  interface RunRef {
    activeRunId: string | null;
    workflowRunId: string | null;
    startedAt: Date | null;
    turn: AgentTurnMarker | undefined;
  }

  /**
   * A run row `prompt` wrote ahead of the workflow it is about to start: its `externalRunId` is
   * still its own id. It is the session's turn lease until the started run is bound to it.
   */
  const isRunLease = (row: RunRef): boolean =>
    row.activeRunId !== null && row.workflowRunId === row.activeRunId;

  /**
   * How long an unbound lease counts as running. `prompt` binds within milliseconds or marks the
   * row failed; only a process that died in between leaves a lease this old, and the next prompt
   * replaces it.
   */
  const RUN_LEASE_TTL_MS = 60_000;

  /**
   * What the durable run is doing right now. `running` is a turn step executing; `waiting` is the
   * run parked on its message or approval hook; `null` means no live run. The SDK's own status
   * cannot tell the first two apart — a parked run is `running` too — so the turn marker the step
   * maintains decides.
   */
  const runStateOf = async (
    row: RunRef
  ): Promise<{ id: string; status: "running" | "waiting" } | null> => {
    if (!row.workflowRunId) return null;
    if (isRunLease(row)) {
      const age = Date.now() - (row.startedAt?.getTime() ?? 0);
      return age < RUN_LEASE_TTL_MS
        ? { id: row.workflowRunId, status: "running" }
        : null;
    }
    if (!(await isRunLive(row.workflowRunId))) return null;
    return {
      id: row.workflowRunId,
      status: row.turn?.running ? "running" : "waiting",
    };
  };

  /**
   * Marks the run's next turn as running before the workflow is woken to run it, so maintenance
   * refuses from the moment a turn is accepted rather than from the moment its step starts. The
   * step rewrites the marker with the same leaf and index when it begins. A turn already running
   * keeps its marker: this one queues behind it, and the step marks it when its own turn comes.
   */
  const claimTurn = async (
    db: DB,
    row: OwnedSession,
    position: AgentStreamPosition
  ): Promise<void> => {
    if (!row.activeRunId || row.turn?.running) return;
    const turn: AgentTurnMarker = {
      seqBefore: await getAgentSessionLastSeq(db, row.id),
      ...position,
      running: true,
    };
    await patchAgentRunMetadata(db, row.activeRunId, {
      [AGENT_TURN_KEY]: turn,
    });
  };

  /**
   * Where the next turn on a live run will begin: one past the current tail of each durable
   * stream. Captured before the run is woken, so a turn still active shares this continuation
   * with the queued one in durable emission order.
   */
  const nextTurnPosition = async (
    runId: string
  ): Promise<AgentStreamPosition> => {
    const run = getRun(runId);
    const [coarseTail, deltaTail] = await Promise.all([
      run.getReadable().getTailIndex(),
      run.getReadable({ namespace: AGENT_DELTA_NAMESPACE }).getTailIndex(),
    ]);
    return { streamIndex: coarseTail + 1, deltaStreamIndex: deltaTail + 1 };
  };

  const cursorOf = (
    runId: string,
    position: AgentStreamPosition
  ): AgentStreamCursor => ({
    runId,
    startIndex: position.streamIndex,
    deltaStartIndex: position.deltaStreamIndex,
  });

  /**
   * How long `abort` waits for the stopped turn's `run:end` before cancelling the run regardless.
   * A tool that ignores its signal keeps Pi waiting on it; the cancel then proceeds and the
   * tool's result, if it ever comes, is closed on replay as aborted.
   */
  const ABORT_SETTLE_TIMEOUT_MS = 10_000;

  /**
   * Waits for the turn step to write the stopped turn's `run:end`.
   *
   * The signal stops Pi, but the step still has the partial reply and any in-flight tool result
   * to persist before the terminal event; the client rebuilds the transcript the moment `abort`
   * returns, so returning earlier would show it a turn still missing its last entries. The turn's
   * own durable stream is the wait: `runPiTurn` appends every entry before emitting its wire
   * event, so `run:end` arriving means the transcript is complete.
   */
  const waitForTurnEnd = async (
    runId: string,
    startIndex: number
  ): Promise<void> => {
    const reader = getRun(runId)
      .getReadable<AgentWireEvent>({ startIndex })
      .getReader();
    // Cancelling settles the pending read as done; the loop then falls through.
    const deadline = setTimeout(
      () => void reader.cancel().catch(() => undefined),
      ABORT_SETTLE_TIMEOUT_MS
    );
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done || value?.type === "run:end") return;
      }
    } catch {
      // A dropped stream has nothing more to tell; the cancel below proceeds as before.
    } finally {
      clearTimeout(deadline);
      await reader.cancel().catch(() => undefined);
    }
  };

  /**
   * Cancels a run that was live a moment ago.
   *
   * `cancel()` refuses a run that has since reached a terminal state — the storage layer
   * throws `EntityConflictError` rather than no-op — so the check is redone on failure: a
   * run that finished on its own is exactly the outcome the caller wanted, while a run
   * that is still live means the cancel genuinely failed and must surface.
   */
  const cancelLiveRun = async (runId: string): Promise<void> => {
    try {
      await workflowControl.cancelRun(runId);
    } catch (error) {
      if (await isRunLive(runId)) throw error;
    }
  };

  /**
   * Whether a hook token is registered and can be resumed.
   *
   * `createHook()` does not register on call. This workflow registers through `getConflict()` before
   * its first turn, but `start()` may return before the workflow reaches that line. Checking once
   * turns that startup race into a retryable answer instead of a failed `resume()`; it is not a
   * timer or polling loop.
   */
  const isHookReady = async (token: string): Promise<boolean> => {
    try {
      return Boolean(await getHookByToken(token));
    } catch {
      return false;
    }
  };

  /**
   * Approvals still awaiting a decision.
   *
   * Used to refuse a new prompt while the run is parked on an approval hook. The message would
   * otherwise sit in the event log unread until the approval resolved, which looks to the operator
   * like their message vanished.
   */
  const undecidedApprovals = async (
    db: DB,
    sessionId: string
  ): Promise<string[]> => {
    const approvals = await getAgentApprovals(db, sessionId);
    return approvals
      .filter((approval) => approval.decidedAt === null)
      .map((approval) => approval.toolName);
  };

  /**
   * The branch as it was persisted before the running turn started. Everything the turn appends
   * — its own user message included — is replayed by `attach` from the run's stream, which starts
   * at the marker's `streamIndex`, before the turn announces `user`. Taking the user message from
   * both sources showed it twice to a client that rejoined mid-turn.
   */
  const entriesBeforeTurn = (
    entries: SessionEntry[],
    turn: AgentTurnMarker
  ): SessionEntry[] => entriesUpToSeq(entries, turn.seqBefore);

  const detailFor = async (caller: AgentServiceCaller, sessionId: string) => {
    const row = await loadOwnedSession(caller, sessionId);
    if (!row) return null;

    const db = caller.context.db;
    const session = await repoFor(db).openById(sessionId);

    const [branch, kindDetail, stats, approvals] = await Promise.all([
      session.getBranch(),
      definition.state.detail(db, sessionId, row.state),
      session.getSessionStats(),
      getAgentApprovals(db, sessionId),
    ]);
    /**
     * Read after the branch, on purpose: the cut below and the entries it cuts must come from the same
     * observation. A turn that finished between the two reads has already persisted its reply; a
     * marker read before the branch would still say `running`, cut that reply out, and leave nothing
     * for `attach` to replay.
     */
    const activeRun = await getActiveAgentRun(db, sessionId);
    const turn = activeRun
      ? readAgentTurnMarker(activeRun.metadata)
      : undefined;
    const run = await runStateOf({
      activeRunId: activeRun?.id ?? null,
      workflowRunId: activeRun?.externalRunId ?? null,
      startedAt: activeRun?.startedAt ?? null,
      turn,
    });

    /**
     * A running turn is not replayed from the transcript: `attach` replays it from the run's stream
     * instead, and both cut at the same recorded marker so the client sees each message once.
     */
    const transcriptEntries =
      run?.status === "running" && turn
        ? entriesBeforeTurn(branch, turn)
        : branch;
    const events = entriesToWireEvents(transcriptEntries, replayOptions);

    // Approval events are never replayed from the transcript; the rows are. A pending row restores
    // the prompt on reload, a decided one closes its card the way the live stream did.
    const approvalRows = approvals.map((approval) => ({
      toolCallId: approval.toolCallId,
      toolName: approval.toolName,
      args: approval.args ?? undefined,
      status: approval.status,
      comment: approval.comment ?? undefined,
    }));

    return {
      session: summaryOf(row),
      settings: settingsOf(row),
      runtimeConfig: row.runtimeConfig,
      configVersion: row.configVersion,
      ...kindDetail,
      run,
      events,
      approvals: approvalRows,
      stats: {
        messageCount: stats.messageCount,
        contextTokens: estimateBranchContextTokens(transcriptEntries),
        totalTokens: stats.totalTokens,
        costTotal: stats.costTotal,
      },
    };
  };

  /**
   * Maintenance (compact, rewind, fork) mutates or copies the session tree, so it cannot run
   * while a turn is appending to it. A live run is not enough to refuse on — parked on the
   * message hook is its normal idle state — so this reads the turn marker, like everything else
   * that needs to know. Called under the session lock, after the row was read under it: a turn
   * accepted before the lock was taken is already marked, and one accepted after waits.
   *
   * An undecided approval refuses too: the run is parked on the approval hook, and the relay
   * turn its decision starts would land on whatever branch is active then — answering a call
   * that is no longer on it. `CONFLICT`, converted at the route.
   */
  const assertMaintainable = async (
    row: OwnedSession,
    db: DB,
    action: string
  ): Promise<void> => {
    if ((await runStateOf(row))?.status === "running") {
      throw new AppError("CONFLICT", {
        message: `Cannot ${action} while a turn is running. Wait for it to finish or abort it.`,
      });
    }
    const outstanding = await undecidedApprovals(db, row.id);
    if (outstanding.length > 0) {
      throw new AppError("CONFLICT", {
        message: `Cannot ${action} while \`${outstanding.join("`, `")}\` awaits your decision. Approve or reject it first.`,
      });
    }
  };

  /** The entry a rewind or fork targets, or `NOT_FOUND`; the client only ever holds ids it was shown. */
  const requireEntry = async (
    session: SessionTree,
    entryId: string
  ): Promise<SessionEntry> => {
    const entry = await session.getEntry(entryId);
    if (!entry) {
      throw new AppError("NOT_FOUND", {
        message: `Entry ${entryId} is not in this session.`,
      });
    }
    return entry;
  };

  // ============================================
  // Service
  // ============================================

  const service: AgentKindService = {
    minTier: definition.minTier,

    async listSessions(caller, input) {
      const db = caller.context.db;
      const metadata = await repoFor(db).list({
        userId: caller.userId,
        limit: input?.limit,
        includeDeleted: input?.includeDeleted,
      });

      const rows = await Promise.all(
        metadata.map((entry) => loadOwnedRow(caller, entry.id))
      );

      return {
        items: rows.flatMap((row) => (row ? [summaryOf(row)] : [])),
        // Sessions are listed newest-first with a hard limit; there is no cursor to page yet.
        nextCursor: null,
      };
    },

    async createSession(caller, input) {
      const db = caller.context.db;
      // The operator's defaults for this kind, read now: a session copies them onto its own row.
      const { defaults } = await loadKindConfig(db, definition);
      const session = await repoFor(db, defaults).create({
        userId: caller.userId,
        title: input.title,
        settings: {
          providerId: input.model?.providerId,
          modelId: input.model?.modelId,
          thinkingLevel:
            /* SAFETY: The producer contract guarantees this value satisfies ThinkingLevel | undefined. */ input.thinkingLevel as
              | ThinkingLevel
              | undefined,
          autoApprove:
            /* SAFETY: The producer contract guarantees this value satisfies ToolTier[] | undefined. */ input.autoApprove as
              | ToolTier[]
              | undefined,
        },
        runtimeConfig: input.runtimeConfig,
      });
      const { id } = session;
      try {
        await definition.state.create(caller, db, id, input);

        const detail = await detailFor(caller, id);
        if (!detail)
          throw new Error("Session vanished immediately after creation");
        return detail;
      } catch (error) {
        // Core and kind state live in separate tables. Compensate if the kind's setup fails so
        // callers never receive an unusable half-created session.
        await deleteAgentSession(db, id);
        throw error;
      }
    },

    getSession(caller, input) {
      return detailFor(caller, input.sessionId);
    },

    async deleteSession(caller, input) {
      const row = await loadOwnedSession(caller, input.sessionId);
      if (!row) return false;

      // End the run before soft-deleting, so it is not left parked on a hook forever.
      // Cancelled rather than sent the end sentinel: the run may be parked on an
      // *approval* hook, where a queued message is never read — and once the session is
      // deleted nobody can decide the approval, so the run would stay parked for good.
      if (row.workflowRunId && (await isRunLive(row.workflowRunId))) {
        await cancelLiveRun(row.workflowRunId);
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
          /* SAFETY: The producer contract guarantees this value satisfies ThinkingLevel | undefined. */ input.thinkingLevel as
            | ThinkingLevel
            | undefined,
        activeToolNames: input.activeToolNames,
        autoApprove:
          /* SAFETY: The producer contract guarantees this value satisfies ToolTier[] | undefined. */ input.autoApprove as
            | ToolTier[]
            | undefined,
        runtimeConfig: input.runtimeConfig,
      });

      return detailFor(caller, input.sessionId);
    },

    /**
     * Enqueues a turn.
     *
     * If the session already has a live run, its reusable hook durably queues the message. The
     * workflow consumes it after the current turn and any approval handshake finish. Otherwise a new
     * run is started and its id recorded.
     *
     * Either way this returns as soon as the message is accepted; the turn itself runs in the run.
     * The whole step holds the session lock, so maintenance can neither slip in between the turn
     * being accepted and its marker being visible, nor be mid-mutation when the turn starts.
     */
    prompt: (outer, input) =>
      withAgentSessionLock(outer.context.db, input.sessionId, async (tx) => {
        const caller = withDb(outer, tx);
        const db = tx;
        const row = await loadOwnedSession(caller, input.sessionId);
        if (!row) throw new Error(`Unknown agent session: ${input.sessionId}`);

        if (input.text === AGENT_END_SENTINEL) {
          throw new Error(
            `"${AGENT_END_SENTINEL}" is reserved; it ends the session's run.`
          );
        }

        const message = {
          text: input.text,
          template: input.template,
          preAuthorizeToolNames: input.preAuthorizeToolNames,
          // Refreshed on every prompt: the run outlives any one request, and the operator may have
          // registered or rotated a key since the last turn.
          credentials: readEncryptedAgentCredentials(caller.context.headers),
        };

        /**
         * Refuse while an approval is outstanding.
         *
         * The run is parked on the *approval* hook, not the message hook. A resumed message would be
         * persisted and then sit unread until the approval resolved — from the operator's side their
         * message would simply appear to do nothing. Better to say why.
         */
        const outstanding = await undecidedApprovals(
          caller.context.db,
          input.sessionId
        );
        if (outstanding.length > 0) {
          throw new Error(
            `Waiting on your decision for \`${outstanding.join("`, `")}\`. Approve or reject it before sending another message.`
          );
        }

        if (row.workflowRunId && (await isRunLive(row.workflowRunId))) {
          const token = agentMessageToken(input.sessionId);

          if (!(await isHookReady(token))) {
            throw new Error(
              "The session's run is still starting up. Retry in a moment."
            );
          }

          const position = await nextTurnPosition(row.workflowRunId);
          await claimTurn(db, row, position);
          await workflowControl.resumeAgentMessage(input.sessionId, message);
          return {
            ...cursorOf(row.workflowRunId, position),
            startedRun: false,
          };
        }

        // Started before the session run so its ref can travel in the run's request: every turn then
        // subscribes to this one controller by run id, and `abort` resumes it by id.
        const abortController = await startAgentAbortController();

        // The row is written before the workflow exists and is the session's turn lease from then on:
        // maintenance that takes the lock after this already sees a running turn, and the step's marker
        // writes (addressed by session) always find their row. The workflow backend mints the run id,
        // so the row's own id stands in as `externalRunId` until the started run is bound to it; a
        // start that fails closes the row so the lease does not outlive the attempt.
        const runId = crypto.randomUUID();
        const position: AgentStreamPosition = {
          streamIndex: 0,
          deltaStreamIndex: 0,
        };
        const turn: AgentTurnMarker = {
          seqBefore: await getAgentSessionLastSeq(db, row.id),
          ...position,
          running: true,
        };
        await createAgentRun(db, {
          id: runId,
          sessionId: input.sessionId,
          harnessKind: "workflow",
          externalRunId: runId,
          metadata: {
            agentKind: definition.kind,
            [AGENT_TURN_KEY]: turn,
            [AGENT_ABORT_CONTROLLER_KEY]: {
              id: abortController.id,
              runId: abortController.runId,
            },
          },
        });
        let workflowRunId;
        try {
          workflowRunId = await workflowControl.startAgentSession({
            sessionId: input.sessionId,
            runId,
            userId: caller.userId,
            abortController,
            firstMessage: message,
          });
        } catch (error) {
          await completeAgentRun(db, runId, "failed");
          throw error;
        }
        await bindAgentRunExternalId(db, runId, workflowRunId);

        return { ...cursorOf(workflowRunId, position), startedRun: true };
      }),

    async attach(caller, input) {
      const row = await loadOwnedSession(caller, input.sessionId);
      if (!row?.workflowRunId || !row.turn) return null;
      // A lease has no stream to tail yet; the client's next `get` finds the bound run.
      if (isRunLease(row)) return null;
      const run = await runStateOf(row);
      if (run?.status !== "running") return null;
      return cursorOf(row.workflowRunId, row.turn);
    },

    /**
     * Tails a run's durable stream.
     *
     * The heavy lifting is the SDK's: `getReadable({ startIndex })` replays from the requested point
     * and then delivers live chunks, which is what makes reconnection and multi-viewer work without
     * any coordination on our side.
     */
    async *stream(caller, input) {
      const row = await loadOwnedSession(caller, input.sessionId);
      if (!row) throw new Error(`Unknown agent session: ${input.sessionId}`);

      const runId = input.runId ?? row.workflowRunId;
      if (!runId) return;

      const readable = getRun(runId).getReadable<AgentWireEvent>({
        startIndex: input.startIndex,
      });
      const reader = readable.getReader();

      // Deltas live on their own namespace and arrive batched; merging them here keeps the client's
      // reducer identical whether or not it asked for them.
      const deltaReader =
        input.deltaStartIndex === undefined
          ? undefined
          : getRun(runId)
              .getReadable<AgentWireEvent[]>({
                namespace: AGENT_DELTA_NAMESPACE,
                startIndex: input.deltaStartIndex,
              })
              .getReader();

      try {
        if (!deltaReader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) yield value;
          }
          return;
        }

        /**
         * Two streams, drained as whichever has data next.
         *
         * Racing the two reads (rather than draining one then the other) is what keeps deltas
         * interleaved with the coarse events they belong to.
         */
        let coarsePending = reader.read();
        let deltaPending = deltaReader.read();
        let coarseDone = false;
        let deltaDone = false;

        while (!coarseDone || !deltaDone) {
          const winner = await Promise.race([
            coarsePending.then((result) => ({
              kind: "coarse" as const,
              result,
            })),
            deltaPending.then((result) => ({
              kind: "delta" as const,
              result,
            })),
          ]);

          if (winner.kind === "coarse") {
            if (winner.result.done) {
              coarseDone = true;
              // A never-settling promise keeps the exhausted side out of the race.
              coarsePending = NEVER;
            } else {
              if (winner.result.value) yield winner.result.value;
              coarsePending = reader.read();
            }
          } else {
            if (winner.result.done) {
              deltaDone = true;
              deltaPending = NEVER;
            } else {
              for (const event of winner.result.value ?? []) yield event;
              deltaPending = deltaReader.read();
            }
          }
        }
      } finally {
        await reader.cancel().catch(() => undefined);
        await deltaReader?.cancel().catch(() => undefined);
      }
    },

    async abort(caller, input) {
      const row = await loadOwnedSession(caller, input.sessionId);
      if (!row?.workflowRunId) return false;
      if (!(await isRunLive(row.workflowRunId))) return false;

      // Stop the harness first — cancelling the run does not reach a step already in flight — then
      // cancel the whole run, which is the session's driver; the next prompt starts a fresh one and
      // picks the transcript back up from Postgres. The row is marked last so a failed cancel never
      // leaves a live run behind a non-active row (the next prompt would start a second workflow and
      // hit the hook conflict).
      if (row.abortController) {
        const signalled = await signalAgentAbort(
          row.abortController.id,
          "stopped by the operator"
        );
        if (signalled && row.turn?.running) {
          await waitForTurnEnd(row.workflowRunId, row.turn.streamIndex);
        }
      }
      await cancelLiveRun(row.workflowRunId);
      if (row.activeRunId) {
        await completeAgentRun(caller.context.db, row.activeRunId, "cancelled");
      }
      return true;
    },

    /** The decision starts a relay turn, so it is accepted under the session lock like a prompt. */
    approve: (outer, input) =>
      withAgentSessionLock(outer.context.db, input.sessionId, async (tx) => {
        const caller = withDb(outer, tx);
        const db = tx;
        const row = await loadOwnedSession(caller, input.sessionId);
        if (!row?.workflowRunId) return null;

        // Persist first: the decision must outlive the run, and the permission gate reads it back from
        // here when the tool call is re-issued.
        const decided = await decideAgentApproval(db, {
          sessionId: input.sessionId,
          toolCallId: input.toolCallId,
          approved: input.approved,
          comment: input.comment,
          decidedBy: caller.userId,
        });
        if (!decided) return null;

        // Capture the cursor before waking the workflow. The chat transport opens a fresh request for
        // an approval continuation, so it needs the same exact replay boundary as a normal prompt.
        const position = await nextTurnPosition(row.workflowRunId);
        await claimTurn(db, row, position);

        // Then wake the run, which has been parked on this hook with no compute consumed.
        await workflowControl.resumeAgentApproval(
          input.sessionId,
          input.toolCallId,
          {
            approved: input.approved,
            comment: input.comment,
            // The turns the workflow synthesises after this decision have no request of their own.
            credentials: readEncryptedAgentCredentials(caller.context.headers),
          }
        );

        return cursorOf(row.workflowRunId, position);
      }),

    compact: (outer, input) =>
      withAgentSessionLock(outer.context.db, input.sessionId, async (tx) => {
        const caller = withDb(outer, tx);
        const row = await loadOwnedSession(caller, input.sessionId);
        if (!row) return null;
        await assertMaintainable(row, tx, "compact");

        const maintenance = await maintenanceFor(caller, row);
        return await maintenance.compact(input.customInstructions);
      }),

    navigate: (outer, input) =>
      withAgentSessionLock(outer.context.db, input.sessionId, async (tx) => {
        const caller = withDb(outer, tx);
        const row = await loadOwnedSession(caller, input.sessionId);
        if (!row) return null;
        await assertMaintainable(row, tx, "rewind");

        const maintenance = await maintenanceFor(caller, row);
        await requireEntry(maintenance.session, input.entryId);
        // No signal is passed, so the summary cannot be cancelled and the result is never `cancelled`.
        await maintenance.navigate(input.entryId, {
          summarize: input.summarize,
          label: input.label,
        });
        return detailFor(caller, input.sessionId);
      }),

    fork: (outer, input) =>
      withAgentSessionLock(outer.context.db, input.sessionId, async (tx) => {
        const caller = withDb(outer, tx);
        const db = tx;
        const row = await loadOwnedSession(caller, input.sessionId);
        if (!row) return null;
        await assertMaintainable(row, db, "fork");

        const repo = repoFor(db);
        const position = input.position ?? "before";
        if (input.entryId) {
          const target = await requireEntry(
            await repo.openById(row.id),
            input.entryId
          );
          if (
            position === "before" &&
            (target.type !== "message" || target.message.role !== "user")
          ) {
            throw new AppError("BAD_REQUEST", {
              message:
                "Only a user message can be forked before; fork at this entry instead.",
            });
          }
        }

        const forked = await repo.fork(
          { id: row.id },
          { entryId: input.entryId, position, title: input.title }
        );
        try {
          await definition.state.fork(db, row.id, forked.id);
          const detail = await detailFor(caller, forked.id);
          if (!detail)
            throw new Error("Session vanished immediately after fork");
          return detail;
        } catch (error) {
          // Same compensation as `createSession`: a fork without its kind state can never be opened.
          await deleteAgentSession(db, forked.id);
          throw error;
        }
      }),

    /**
     * The pre-persistence check the transport calls.
     *
     * Returns a reason instead of throwing because the caller is a middleware turning this into a
     * `BAD_REQUEST`. The kind's `assert` checks policy *and* catalogue membership — the latter is
     * what stops a typo on a native provider from being stored and then failing on every subsequent
     * turn, deep in the workflow step where the operator cannot see why.
     */
    validateModel(ref) {
      try {
        definition.models.assert(ref);
        return Promise.resolve(null);
      } catch (error) {
        return Promise.resolve(
          error instanceof UnknownAgentModelError
            ? error.message
            : `Could not validate model "${ref.modelId}".`
        );
      }
    },

    listModels(caller) {
      /**
       * Which BYOK providers this caller has a key for. Read from the cookie rather than decrypted:
       * the picker only needs to know whether a key is *present*, and decrypting to answer a listing
       * request would put plaintext keys on a path that has no use for them.
       */
      const registered = readEncryptedAgentCredentials(caller.context.headers);
      const configured = BYOK_PROVIDER_IDS.filter(
        (providerId) => registered?.[providerId]
      );
      return Promise.resolve(definition.models.list({ configured }));
    },

    listCapabilities() {
      return Promise.resolve(definition.capabilities());
    },
  };

  return service;
};
