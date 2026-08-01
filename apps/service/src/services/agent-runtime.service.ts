import { getHookByToken, getRun, start } from "workflow/api";

import {
  entriesToWireEvents,
  PgPendingMessageStore,
  PgSessionRepo,
  UnknownAgentModelError,
  writeSessionSettings,
} from "@chia/agent-core";
import type {
  AgentSessionSettings,
  AgentWireEvent,
  ThinkingLevel,
  ToolTier,
} from "@chia/agent-core";
import {
  createWritingMaintenanceEngine,
  createWritingTools,
  isWritingModelId,
  listWritingModels,
  PgDraftStore,
  WRITING_MODEL_IDS,
  WRITING_AGENT_KIND,
  WRITING_SESSION_DEFAULTS,
  writingPolicy,
  writingPromptTemplates,
  writingSkills,
} from "@chia/agent-writing";
import { registerAgentRuntime } from "@chia/api/orpc/agent-runtime";
import type {
  AgentRuntime,
  AgentRuntimeCaller,
} from "@chia/api/orpc/agent-runtime";
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

import { AGENT_DELTA_NAMESPACE } from "../steps/agent-turn.step";
import { agentSessionWorkflow } from "../workflows/agent-session.workflow";
import {
  AGENT_END_SENTINEL,
  agentApprovalHook,
  agentApprovalToken,
  agentMessageHook,
  agentMessageToken,
} from "../workflows/hooks/agent.hooks";

import { createAgentContentPort } from "./agent-content.port";
import { getAgentPendingNotifier } from "./agent-pending-notifier";

/**
 * The **writing** agent runtime, registered under `agent_session.kind = "writing"`.
 *
 * Session, approval and wire primitives are `@chia/agent-core`; engine execution is
 * `@chia/agent-runtime`; the writing domain is `@chia/agent-writing`. This module is the
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

const dependenciesFor = (caller: AgentRuntimeCaller) => {
  const db = caller.context.db as DB;
  return {
    db,
    repo: repoFor(db),
    draft: new PgDraftStore(db),
    pending: new PgPendingMessageStore(db),
    content: createAgentContentPort({
      db,
      kv: caller.context.kv,
      adminId: caller.adminId,
    }),
  };
};

/**
 * Loads a session **scoped to the caller**.
 *
 * The session id arrives from client input, so ownership is re-checked here rather than trusted —
 * `adminGuard` proves who is calling, not what they may open.
 */
const loadOwnedSession = async (
  caller: AgentRuntimeCaller,
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
 * Opens a session plus the stripped-down handle for `compact` and `navigate`.
 *
 * These operations only walk the session tree, so they get a maintenance engine — no tools, no
 * skills, no system prompt, no approval gate, and no event subscriptions, since their events belong
 * to no turn and had to be discarded anyway. The draft store, pending-message store and content
 * port are skipped for the same reason, which is why this reaches for `repoFor` rather than the
 * full `dependenciesFor`.
 */
const openMaintenanceEngine = async (
  caller: AgentRuntimeCaller,
  sessionId: string,
  row: Parameters<typeof settingsOf>[0]
) => {
  const session = await repoFor(caller.context.db as DB).openById(sessionId);
  const engine = await createWritingMaintenanceEngine({
    agentSessionId: sessionId,
    session,
    settings: settingsOf(row),
  });
  return { session, engine };
};

const replayOptions = {
  tierOf: writingPolicy.tierOf,
  labelOf: writingPolicy.labelOf,
  summarize: writingPolicy.summarize,
};

/**
 * A promise that never settles, used to drop an exhausted reader out of the two-stream race in
 * {@link agentRuntime.stream} without it winning again.
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
 * Whether a hook token is registered and can be resumed.
 *
 * `createHook()` does not register on call — registration commits when the workflow first
 * suspends. So there is a window right after `start()` where the run is live but its message hook
 * does not exist yet, and `resume()` on it would throw. Checking first turns that into a
 * retryable answer instead of a 500.
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

const detailFor = async (caller: AgentRuntimeCaller, sessionId: string) => {
  const row = await loadOwnedSession(caller, sessionId);
  if (!row) return null;

  const { db, repo, draft } = dependenciesFor(caller);
  const session = await repo.openById(sessionId);

  const [branch, draftState, stats, approvals] = await Promise.all([
    session.getBranch(),
    draft.get(sessionId),
    session.getSessionStats(),
    getAgentApprovals(db, sessionId),
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
// Runtime
// ============================================

export const writingAgentRuntime: AgentRuntime = {
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

    if (input.modelId) assertKnownModel(input.modelId);

    const session = await repo.create({
      userId: caller.userId,
      title: input.title,
      settings: {
        modelId: input.modelId,
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
    if (row.workflowRunId && (await isRunLive(row.workflowRunId))) {
      await agentMessageHook.resume(agentMessageToken(input.sessionId), {
        text: AGENT_END_SENTINEL,
      });
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
    if (input.modelId) assertKnownModel(input.modelId);

    await writeSessionSettings(caller.context.db as DB, input.sessionId, {
      title: input.title,
      modelId: input.modelId,
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
   * If the session already has a live run, the message is delivered through its hook — the run is
   * parked waiting for exactly this. Otherwise a new run is started and its id recorded.
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
      // Capture the tail *before* enqueuing, so the returned index points at this turn's first
      // event rather than replaying the whole session.
      const startIndex = (await run.getReadable().getTailIndex()) + 1;
      await agentMessageHook.resume(token, message);
      return { runId: row.workflowRunId, startIndex, startedRun: false };
    }

    const run = await start(agentSessionWorkflow, [
      {
        sessionId: input.sessionId,
        adminId: caller.adminId,
        userId: caller.userId,
        firstMessage: message,
      },
    ]);

    await createAgentRun(caller.context.db as DB, {
      id: run.runId,
      sessionId: input.sessionId,
      harnessKind: "workflow",
      externalRunId: run.runId,
      metadata: { agentKind: WRITING_AGENT_KIND },
    });

    return { runId: run.runId, startIndex: 0, startedRun: true };
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
    // picks the transcript back up from Postgres.
    await getRun(row.workflowRunId).cancel();
    if (row.activeRunId) {
      await completeAgentRun(
        caller.context.db as DB,
        row.activeRunId,
        "cancelled"
      );
    }
    return true;
  },

  async steer(caller, input) {
    const row = await loadOwnedSession(caller, input.sessionId);
    if (!row) return false;
    const { pending } = dependenciesFor(caller);
    await pending.push(input.sessionId, input.queue ?? "steer", input.text);

    /**
     * Nudge the running turn, strictly after the row is durable — the other order would let a
     * subscriber drain before the message exists and waste the wake-up. Failure is ignored on
     * purpose: the message is already stored, so the worst case is the turn's next poll.
     */
    try {
      await getAgentPendingNotifier()?.publish(input.sessionId);
    } catch {
      // Accelerator only.
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

    // Capture the cursor before waking the workflow. The TanStack compatibility transport opens a
    // fresh request for an approval continuation, unlike the native dashboard's old long-lived
    // subscription, so it needs the same exact replay boundary as a normal prompt.
    const run = getRun(row.workflowRunId);
    const startIndex = (await run.getReadable().getTailIndex()) + 1;

    // Then wake the run, which has been parked on this hook with no compute consumed.
    await agentApprovalHook.resume(
      agentApprovalToken(input.sessionId, input.toolCallId),
      { approved: input.approved, comment: input.comment }
    );

    return { runId: row.workflowRunId, startIndex };
  },

  async compact(caller, input) {
    const row = await loadOwnedSession(caller, input.sessionId);
    if (!row) return null;
    await assertNoTurnRunning(row.workflowRunId, "compact");

    const { engine } = await openMaintenanceEngine(
      caller,
      input.sessionId,
      row
    );

    try {
      const result = await engine.compact(input.customInstructions);
      return { summary: result.summary, tokensBefore: result.tokensBefore };
    } finally {
      engine.dispose();
    }
  },

  async navigate(caller, input) {
    const row = await loadOwnedSession(caller, input.sessionId);
    if (!row) return null;
    await assertNoTurnRunning(row.workflowRunId, "rewind");

    const { session, engine } = await openMaintenanceEngine(
      caller,
      input.sessionId,
      row
    );

    try {
      const result = await engine.navigate(input.entryId, {
        summarize: input.summarize,
        label: input.label,
      });
      // The branch changed, so the client's whole transcript is stale — hand back the new one.
      const branch = await session.getBranch();
      return {
        cancelled: result.cancelled,
        events: entriesToWireEvents(branch, replayOptions),
      };
    } finally {
      engine.dispose();
    }
  },

  async getDraft(caller, input) {
    const row = await loadOwnedSession(caller, input.sessionId);
    if (!row) return null;
    const { draft } = dependenciesFor(caller);
    return (await draft.get(input.sessionId)) as never;
  },

  listModels() {
    return Promise.resolve(listWritingModels());
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
 * appending to it.
 *
 * A live run is not enough to refuse on — it may simply be parked on the message hook, which is the
 * normal idle state. Only an actually-executing turn conflicts, and `running` is the closest signal
 * the run exposes.
 */
const assertNoTurnRunning = async (
  runId: string | null,
  action: string
): Promise<void> => {
  if (!runId) return;
  try {
    const run = getRun(runId);
    if (!(await run.exists)) return;
    if ((await run.status) === "running") {
      throw new Error(
        `Cannot ${action} while a turn is running. Wait for it to finish or abort it.`
      );
    }
  } catch (error) {
    // Re-throw our own refusal; swallow lookup failures for runs that no longer resolve.
    if (error instanceof Error && error.message.startsWith("Cannot "))
      throw error;
  }
};

const assertKnownModel = (modelId: string) => {
  if (!isWritingModelId(modelId)) {
    throw new UnknownAgentModelError(modelId, WRITING_MODEL_IDS);
  }
};

/** Registers this runtime under its kind. Called once at module load. */
export const registerAgentRuntimeService = (): void => {
  registerAgentRuntime(WRITING_AGENT_KIND, writingAgentRuntime);
};
