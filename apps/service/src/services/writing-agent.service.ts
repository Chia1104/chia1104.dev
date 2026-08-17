import { getHookByToken, getRun, start } from "workflow/api";

import {
  BYOK_PROVIDER_IDS,
  createAgentModels,
  entriesToWireEvents,
  PgSessionRepo,
  UnknownAgentModelError,
  writeSessionSettings,
} from "@chia/agent-runtime";
import type {
  AgentSessionSettings,
  AgentWireEvent,
  SessionTreeEntry,
  ThinkingLevel,
  ToolTier,
} from "@chia/agent-runtime";
import {
  compactWritingSession,
  createWritingTools,
  assertWritingModel,
  listWritingModels,
  navigateWritingSession,
  PgDraftStore,
  WRITING_AGENT_KIND,
  WRITING_SESSION_DEFAULTS,
  writingPolicy,
  writingPromptTemplates,
  writingSkills,
} from "@chia/agent-writing";
import type {
  AgentKindService,
  AgentServiceCaller,
} from "@chia/api/orpc/services/agent.service";
import type { DB } from "@chia/db";
import {
  completeAgentRun,
  createAgentRun,
  createWritingAgentSession,
  decideAgentApproval,
  deleteAgentSession,
  getActiveAgentRun,
  getAgentApprovals,
  getAgentSession,
  getWritingAgentSession,
  softDeleteAgentSession,
} from "@chia/db/repos/agent";
import { CallerTier } from "@chia/service-kit/policies";

import {
  AGENT_DELTA_NAMESPACE,
  AGENT_TURN_KEY,
  readAgentTurnMarker,
} from "../steps/agent-turn.step";
import type { AgentTurnMarker } from "../steps/agent-turn.step";
import { agentSessionWorkflow } from "../workflows/agent-session.workflow";
import {
  AGENT_END_SENTINEL,
  agentApprovalHook,
  agentApprovalToken,
  agentMessageHook,
  agentMessageToken,
} from "../workflows/hooks/agent.hooks";

import { createAgentContentPort } from "./agent-content.port";
import {
  decryptAgentCredentials,
  readEncryptedAgentCredentials,
} from "./agent-credentials";

/**
 * The **writing** agent service, registered under `agent_session.kind = "writing"`.
 *
 * Pi execution, session persistence, approval and wire primitives are `@chia/agent-runtime`;
 * the writing domain is `@chia/agent-writing`. This module is the
 * transport-facing glue between them and the durable workflow run. A second agent kind is a
 * sibling of this file plus its own domain package.
 *
 * **Stateless.** There is no in-process registry: each session is driven by a durable workflow run,
 * and every piece of state lives somewhere durable —
 *
 * - transcript → `agent_session_entry` (queried directly by the dashboard, and the source pi
 *   rebuilds context from)
 * - draft buffer → `writing_agent_session` + `writing_agent_draft`
 * - approval decisions → `agent_tool_approval`
 * - turn execution metadata → `agent_run`; pauses and event stream → the workflow backend
 *
 * That split is why a deploy mid-turn is survivable and why an approval can be granted a day later.
 * It is also why this module can be replicated across instances without a coordination layer.
 */

// ============================================
// Helpers
// ============================================

const repoFor = (db: DB) =>
  new PgSessionRepo(db, {
    kind: WRITING_AGENT_KIND,
    defaults: WRITING_SESSION_DEFAULTS,
  });

const dependenciesFor = (caller: AgentServiceCaller) => {
  const db = caller.context.db as DB;
  return {
    db,
    repo: repoFor(db),
    draft: new PgDraftStore(db),
    content: createAgentContentPort({
      db,
      adminId: caller.adminId,
    }),
  };
};

/**
 * Loads a session **scoped to the caller**.
 *
 * The session id arrives from client input, so ownership is re-checked here rather than trusted —
 * the guard proves who is calling, not what they may open.
 */
const loadOwnedSession = async (
  caller: AgentServiceCaller,
  sessionId: string
) => {
  const db = caller.context.db as DB;
  const row = await getAgentSession(db, sessionId);
  if (!row || row.deletedAt !== null) return null;
  if (row.userId !== caller.userId) return null;
  if (row.kind !== WRITING_AGENT_KIND) return null;

  const [writingState, activeRun] = await Promise.all([
    getWritingAgentSession(db, sessionId),
    getActiveAgentRun(db, sessionId),
  ]);
  if (!writingState) return null;

  return {
    ...row,
    targetFeedId: writingState.targetFeedId,
    feedMeta: writingState.feedMeta,
    activeRunId: activeRun?.id ?? null,
    workflowRunId: activeRun?.externalRunId ?? null,
    turn: activeRun ? readAgentTurnMarker(activeRun.metadata) : undefined,
  };
};

const settingsOf = (row: {
  id: string;
  providerId: string | null;
  modelId: string | null;
  thinkingLevel: string | null;
  activeToolNames: string[] | null;
  autoApprove: string[];
}): AgentSessionSettings => {
  if (!row.providerId || !row.modelId || !row.thinkingLevel) {
    throw new Error(`Writing session ${row.id} has incomplete LLM settings.`);
  }
  return {
    providerId: row.providerId,
    modelId: row.modelId,
    thinkingLevel: row.thinkingLevel as ThinkingLevel,
    activeToolNames: row.activeToolNames,
    autoApprove: row.autoApprove as ToolTier[],
  };
};

const summaryOf = (row: {
  id: string;
  title: string | null;
  kind: string;
  providerId: string | null;
  modelId: string | null;
  thinkingLevel: string | null;
  activeToolNames: string[] | null;
  autoApprove: string[];
  targetFeedId: number | null;
  createdAt: Date;
  updatedAt: Date;
}) => {
  const settings = settingsOf(row);
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    modelId: settings.modelId,
    thinkingLevel: settings.thinkingLevel,
    targetFeedId: row.targetFeedId,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
};

/**
 * Loads the Pi session inputs used by explicit maintenance operations.
 *
 * These operations only walk the session tree, so the concrete Pi operations receive no tools,
 * skills, approval gate or event subscriptions. The draft store and content port are skipped for
 * the same reason, which is why this reaches for `repoFor` rather than the full `dependenciesFor`.
 */
const writingSessionOperationOptions = async (
  caller: AgentServiceCaller,
  sessionId: string,
  row: Parameters<typeof settingsOf>[0]
) => {
  const session = await repoFor(caller.context.db as DB).openById(sessionId);
  return {
    session,
    settings: settingsOf(row),
    /**
     * Compaction calls the model too, so a BYOK session needs its key here just as much as in a
     * turn. This path runs inside the request, so the cookie is read and decrypted directly rather
     * than travelling through the workflow.
     */
    models: modelsFor(caller),
  };
};

/** Per-request `Models`, carrying whatever provider keys the caller has registered. */
const modelsFor = (caller: AgentServiceCaller) =>
  createAgentModels(
    decryptAgentCredentials(
      readEncryptedAgentCredentials(caller.context.headers)
    )
  );

const replayOptions = {
  tierOf: writingPolicy.tierOf,
  labelOf: writingPolicy.labelOf,
  summarize: writingPolicy.summarize,
};

/**
 * A promise that never settles, used to drop an exhausted reader out of the two-stream race in
 * {@link writingAgentService.stream} without it winning again.
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

/**
 * What the durable run is doing right now. `running` is a turn step executing; `waiting` is the
 * run parked on its message or approval hook; `null` means no live run. The SDK's own status
 * cannot tell the first two apart — a parked run is `running` too — so the turn marker the step
 * maintains decides.
 */
const runStateOf = async (row: {
  workflowRunId: string | null;
  turn: AgentTurnMarker | undefined;
}): Promise<{ id: string; status: "running" | "waiting" } | null> => {
  if (!row.workflowRunId || !(await isRunLive(row.workflowRunId))) return null;
  return {
    id: row.workflowRunId,
    status: row.turn?.running ? "running" : "waiting",
  };
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
    await getRun(runId).cancel();
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
 * The branch up to the leaf the running turn started from, plus that turn's own leading user
 * messages: the live replay carries no user text (the client already has what it sent), so the
 * prompt the turn is answering has to come from here for a rejoining client to see it.
 */
const entriesBeforeTurn = (
  entries: SessionTreeEntry[],
  turn: AgentTurnMarker
): SessionTreeEntry[] => {
  const leafIndex =
    turn.leafEntryId === null
      ? -1
      : entries.findIndex((entry) => entry.id === turn.leafEntryId);
  // A marker that is not on this branch cannot cut it; show everything rather than guess.
  if (turn.leafEntryId !== null && leafIndex === -1) return entries;

  let end = leafIndex + 1;
  while (end < entries.length) {
    const entry = entries[end];
    if (entry?.type !== "message" || entry.message.role !== "user") break;
    end += 1;
  }
  return entries.slice(0, end);
};

const detailFor = async (caller: AgentServiceCaller, sessionId: string) => {
  const row = await loadOwnedSession(caller, sessionId);
  if (!row) return null;

  const { db, repo, draft } = dependenciesFor(caller);
  const session = await repo.openById(sessionId);

  const [branch, draftState, stats, approvals, run] = await Promise.all([
    session.getBranch(),
    draft.get(sessionId),
    session.getSessionStats(),
    getAgentApprovals(db, sessionId),
    runStateOf(row),
  ]);

  // Older rows written before PgSessionStorage advanced `leafEntryId` have persisted entries but
  // an empty active branch. Replay those entries in insertion order so existing development
  // sessions remain visible after a refresh. Correctly linked sessions always use their branch.
  let transcriptEntries = branch;
  if (
    branch.length === 0 &&
    row.leafEntryId === null &&
    stats.messageCount > 0
  ) {
    const storedEntries = await session.getStorage().getEntries();
    if (storedEntries.every((entry) => entry.parentId === null)) {
      transcriptEntries = storedEntries;
    }
  }
  /**
   * A running turn is not replayed from the transcript: `attach` replays it from the run's stream
   * instead, and both cut at the same recorded marker so the client sees each message once.
   */
  if (run?.status === "running" && row.turn) {
    transcriptEntries = entriesBeforeTurn(transcriptEntries, row.turn);
  }
  const events = entriesToWireEvents(transcriptEntries, replayOptions);

  // Surface approvals still waiting on a decision, so a reload restores the prompt.
  const pendingApprovals = approvals
    .filter((approval) => approval.status === "pending")
    .map((approval) => ({
      toolCallId: approval.toolCallId,
      toolName: approval.toolName,
      args: approval.args ?? undefined,
    }));

  return {
    session: summaryOf(row),
    settings: settingsOf(row),
    runtimeConfig: row.runtimeConfig,
    configVersion: row.configVersion,
    draft: draftState as never,
    run,
    events,
    pendingApprovals,
    stats: {
      messageCount: stats.messageCount,
      totalTokens: stats.totalTokens,
      costTotal: stats.costTotal,
    },
  };
};

// ============================================
// Service
// ============================================

export const writingAgentService: AgentKindService = {
  /**
   * The configured admin only. These tools write to and publish the blog, so a logged-in visitor
   * must not reach them; `Root` also makes `caller.adminId` and `caller.userId` the same person,
   * which is what lets the content port act as the author.
   */
  minTier: CallerTier.Root,

  async listSessions(caller, input) {
    const { db, repo } = dependenciesFor(caller);
    const metadata = await repo.list({
      userId: caller.userId,
      limit: input?.limit,
      includeDeleted: input?.includeDeleted,
    });

    const rows = await Promise.all(
      metadata.map(async (entry) => {
        const [row, writingState] = await Promise.all([
          getAgentSession(db, entry.id),
          getWritingAgentSession(db, entry.id),
        ]);
        return row && writingState
          ? { ...row, targetFeedId: writingState.targetFeedId }
          : null;
      })
    );

    return {
      items: rows.flatMap((row) => (row ? [summaryOf(row)] : [])),
      // Sessions are listed newest-first with a hard limit; there is no cursor to page yet.
      nextCursor: null,
    };
  },

  async createSession(caller, input) {
    const { repo, draft, content } = dependenciesFor(caller);

    const session = await repo.create({
      userId: caller.userId,
      title: input.title,
      settings: {
        providerId: input.model?.providerId,
        modelId: input.model?.modelId,
        thinkingLevel: input.thinkingLevel as ThinkingLevel | undefined,
        autoApprove: input.autoApprove as ToolTier[] | undefined,
      },
      runtimeConfig: input.runtimeConfig,
    });
    const { id } = await session.getMetadata();
    try {
      await createWritingAgentSession(caller.context.db as DB, {
        sessionId: id,
        targetFeedId: input.targetFeedId,
      });

      // Opening a session against an existing post seeds the buffer, so the agent edits the real
      // content instead of guessing at it.
      if (input.targetFeedId !== undefined) {
        const post = await content.getPost({ feedId: input.targetFeedId });
        if (post) await draft.seedFromPost(id, post);
      }

      const detail = await detailFor(caller, id);
      if (!detail)
        throw new Error("Session vanished immediately after creation");
      return detail;
    } catch (error) {
      // Core and writing state live in separate repositories. Compensate if extension setup or
      // draft seeding fails so callers never receive an unusable half-created session.
      await deleteAgentSession(caller.context.db as DB, id);
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
      await completeAgentRun(
        caller.context.db as DB,
        row.activeRunId,
        "cancelled"
      );
    }

    await softDeleteAgentSession(caller.context.db as DB, input.sessionId);
    return true;
  },

  async updateSettings(caller, input) {
    const row = await loadOwnedSession(caller, input.sessionId);
    if (!row) return null;
    await writeSessionSettings(caller.context.db as DB, input.sessionId, {
      title: input.title,
      providerId: input.model?.providerId,
      modelId: input.model?.modelId,
      thinkingLevel: input.thinkingLevel as ThinkingLevel | undefined,
      activeToolNames: input.activeToolNames,
      autoApprove: input.autoApprove as ToolTier[] | undefined,
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
   */
  async prompt(caller, input) {
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
      caller.context.db as DB,
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

      const run = getRun(row.workflowRunId);
      // Capture the tail before enqueuing. If another turn is active, its remaining events and the
      // queued turn share this continuation stream in durable emission order.
      const startIndex = (await run.getReadable().getTailIndex()) + 1;
      await agentMessageHook.resume(token, message);
      return { runId: row.workflowRunId, startIndex, startedRun: false };
    }

    const run = await start(agentSessionWorkflow, [
      {
        sessionId: input.sessionId,
        userId: caller.userId,
        firstMessage: message,
      },
    ]);

    // The first turn may reach its step before this row exists, in which case its own marker write
    // finds nothing to update; a fresh run always starts its first turn at index 0 from the leaf as
    // it stands now, so the same marker is seeded here. The step's end-of-turn write lands either
    // way, so `running` cannot stick.
    const turn: AgentTurnMarker = {
      leafEntryId: row.leafEntryId,
      streamIndex: 0,
      running: true,
    };
    await createAgentRun(caller.context.db as DB, {
      id: run.runId,
      sessionId: input.sessionId,
      harnessKind: "workflow",
      externalRunId: run.runId,
      metadata: { agentKind: WRITING_AGENT_KIND, [AGENT_TURN_KEY]: turn },
    });

    return { runId: run.runId, startIndex: 0, startedRun: true };
  },

  async attach(caller, input) {
    const row = await loadOwnedSession(caller, input.sessionId);
    if (!row?.workflowRunId || !row.turn) return null;
    const run = await runStateOf(row);
    if (run?.status !== "running") return null;
    return { runId: row.workflowRunId, startIndex: row.turn.streamIndex };
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
    const deltaReader = input.deltas
      ? getRun(runId)
          .getReadable<AgentWireEvent[]>({
            namespace: AGENT_DELTA_NAMESPACE,
            startIndex: 0,
          })
          .getReader()
      : undefined;

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
          coarsePending.then((result) => ({ kind: "coarse" as const, result })),
          deltaPending.then((result) => ({ kind: "delta" as const, result })),
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

    // Cancels the whole run, which is the session's driver — the next prompt starts a fresh one and
    // picks the transcript back up from Postgres. Cancelling does not reach a step already in
    // flight; the turn step polls the `cancelled` row below before each provider request and stops
    // the harness itself.
    await cancelLiveRun(row.workflowRunId);
    if (row.activeRunId) {
      await completeAgentRun(
        caller.context.db as DB,
        row.activeRunId,
        "cancelled"
      );
    }
    return true;
  },

  async approve(caller, input) {
    const row = await loadOwnedSession(caller, input.sessionId);
    if (!row?.workflowRunId) return null;

    // Persist first: the decision must outlive the run, and the permission gate reads it back from
    // here when the tool call is re-issued.
    const decided = await decideAgentApproval(caller.context.db as DB, {
      sessionId: input.sessionId,
      toolCallId: input.toolCallId,
      approved: input.approved,
      comment: input.comment,
      decidedBy: caller.userId,
    });
    if (!decided) return null;

    // Capture the cursor before waking the workflow. The chat transport opens a fresh request for
    // an approval continuation, so it needs the same exact replay boundary as a normal prompt.
    const run = getRun(row.workflowRunId);
    const startIndex = (await run.getReadable().getTailIndex()) + 1;

    // Then wake the run, which has been parked on this hook with no compute consumed.
    await agentApprovalHook.resume(
      agentApprovalToken(input.sessionId, input.toolCallId),
      {
        approved: input.approved,
        comment: input.comment,
        // The turns the workflow synthesises after this decision have no request of their own.
        credentials: readEncryptedAgentCredentials(caller.context.headers),
      }
    );

    return { runId: row.workflowRunId, startIndex };
  },

  async compact(caller, input) {
    const row = await loadOwnedSession(caller, input.sessionId);
    if (!row) return null;
    await assertNoTurnRunning(row, "compact");

    const options = await writingSessionOperationOptions(
      caller,
      input.sessionId,
      row
    );
    return await compactWritingSession(options, input.customInstructions);
  },

  async navigate(caller, input) {
    const row = await loadOwnedSession(caller, input.sessionId);
    if (!row) return null;
    await assertNoTurnRunning(row, "rewind");

    const options = await writingSessionOperationOptions(
      caller,
      input.sessionId,
      row
    );
    const result = await navigateWritingSession(options, input.entryId, {
      summarize: input.summarize,
      label: input.label,
    });
    const branch = await options.session.getBranch();
    return {
      cancelled: result.cancelled,
      events: entriesToWireEvents(branch, replayOptions),
    };
  },

  async getDraft(caller, input) {
    const row = await loadOwnedSession(caller, input.sessionId);
    if (!row) return null;
    const { draft } = dependenciesFor(caller);
    return (await draft.get(input.sessionId)) as never;
  },

  /**
   * The pre-persistence check the transport calls.
   *
   * Returns a reason instead of throwing because the caller is a middleware turning this into a
   * `BAD_REQUEST`. `assertWritingModel` checks policy *and* catalogue membership — the latter is
   * what stops a typo on a native provider from being stored and then failing on every subsequent
   * turn, deep in the workflow step where the operator cannot see why.
   */
  validateModel(ref) {
    try {
      assertWritingModel(ref);
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
    return Promise.resolve(listWritingModels({ configured }));
  },

  listCapabilities() {
    return Promise.resolve({
      tools: createWritingTools().map((tool) => ({
        name: tool.name,
        label: tool.label,
        tier: writingPolicy.tierOf(tool.name),
        description: tool.description,
      })),
      promptTemplates: writingPromptTemplates.map((template) => ({
        name: template.name,
        description: template.description,
      })),
      skills: writingSkills.map((skill) => ({
        name: skill.name,
        description: skill.description,
      })),
    });
  },
};

/**
 * Compaction and rewinding both mutate the session tree, so they cannot run while a turn is
 * appending to it. A live run is not enough to refuse on — parked on the message hook is its
 * normal idle state — so this reads the turn marker, like everything else that needs to know.
 */
const assertNoTurnRunning = async (
  row: { workflowRunId: string | null; turn: AgentTurnMarker | undefined },
  action: string
): Promise<void> => {
  if ((await runStateOf(row))?.status === "running") {
    throw new Error(
      `Cannot ${action} while a turn is running. Wait for it to finish or abort it.`
    );
  }
};
