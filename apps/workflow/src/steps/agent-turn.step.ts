import { FatalError, getWorkflowMetadata, getWritable } from "workflow";
import { getRun } from "workflow/api";

import { loadKindConfig } from "@chia/agent-host/config";
import {
  AGENT_DELTA_NAMESPACE,
  AGENT_TURN_KEY,
} from "@chia/agent-host/execution";
import type { AgentTurnMarker } from "@chia/agent-host/execution";
import type { AgentKindDefinition } from "@chia/agent-host/kind";
import { AGENT_TASK_IDS, resolveAgentTask } from "@chia/agent-host/tasks";
import { recordAgentUsage } from "@chia/agent-host/usage";
import type {
  AgentTurnError,
  ThinkingLevel,
  ToolTier,
} from "@chia/agent-runtime/types";
import type { OperatorDecision } from "@chia/agent-runtime/wire/operator-decision";
import type { AgentWireEvent } from "@chia/agent-runtime/wire/schema";
import type { DB } from "@chia/db/client";
import { connectDatabase } from "@chia/db/client";
import {
  completeAgentRun,
  getAgentSession,
  getAgentSessionLastSeq,
  getApprovedAgentToolCallIds,
  patchAgentRunMetadata,
  recordAgentApprovalRequests,
  setAgentSessionTitleIfUnset,
} from "@chia/db/repos/agent";
import type { JsonObject } from "@chia/utils/json";
import type {
  AgentAbortControllerRef,
  EncryptedAgentCredentials,
} from "@chia/workflow-control/agent-hooks";

import { agentFactory } from "../agents/factory";
import {
  signalAgentAbort,
  subscribeAgentAbort,
} from "../services/agent-abort-controller";
import { decryptAgentCredentials } from "../services/agent-credentials";

/**
 * One agent turn, as a durable step.
 *
 * The engine **must** live here rather than in the workflow function: `"use workflow"` code runs in
 * a sandboxed VM with no Node built-ins and no native `fetch`, and the engine needs `pg` (drizzle)
 * plus outbound HTTP. The workflow function only orchestrates and passes plain data across the
 * boundary.
 */

// ============================================
// Streaming
// ============================================

/**
 * Token-level deltas go to their own namespace.
 *
 * Every `write()` is a durable write, and a single turn produces thousands of deltas. Keeping them
 * off the default stream means a reconnecting client can replay the *coarse* transcript cheaply and
 * opt into the typing animation only if it wants it.
 */
/** Flush window for batching deltas, in milliseconds. */
const DELTA_FLUSH_MS = 80;

// ============================================
// Step contract
// ============================================

export interface AgentTurnRequest {
  sessionId: string;
  /**
   * The `agent.run` row this run owns, written by `prompt` before the workflow was started. Every
   * marker write goes to this row and no other, so a step of a run that was cancelled and
   * replaced cannot reach the run that replaced it.
   */
  runId: string;
  /** Verified at the transport boundary before the run was started. */
  userId: string;
  /** The run's abort controller; the turn subscribes to it for the harness's `AbortSignal`. */
  abortController: AgentAbortControllerRef;
  text: string;
  template?: { name: string; args?: string[] };
  /** Set when this turn relays an operator's decision on a gated call; see `AgentTurnMessage`. */
  decision?: OperatorDecision;
  preAuthorizeToolNames?: string[];
  /**
   * The operator's own provider keys, still encrypted — see `services/agent-credentials.ts`.
   * Absent means the turn runs on the house gateway account.
   */
  credentials?: EncryptedAgentCredentials;
}

export interface AgentApprovalRequestSnapshot {
  toolCallId: string;
  toolName: string;
  args?: JsonObject;
}

export interface AgentTurnOutcome {
  status: "done" | "awaiting_approval" | "aborted" | "error";
  approvals: AgentApprovalRequestSnapshot[];
  error?: AgentTurnError;
}

type AgentSessionRow = NonNullable<Awaited<ReturnType<typeof getAgentSession>>>;

// ============================================
// Title
// ============================================

/** Bounds both the model call and how long `run:end` is held back for the title to land. */
const SESSION_TITLE_TIMEOUT_MS = 8_000;

/** The turn that names a session: the first operator prompt of one that has no title yet. */
const needsTitle = (row: AgentSessionRow, request: AgentTurnRequest) =>
  row.title === null && request.decision === undefined;

/**
 * Names the session from its first prompt, alongside the turn.
 *
 * Started before the turn and awaited before its `run:end` is written, so the client's turn-end
 * refresh already sees the title. The write is conditional on the title still being unset, so an
 * operator who renames the session mid-turn keeps their name. Never throws: a title is cosmetic,
 * and a provider failure falls back to the prompt's first line rather than leaving the session
 * untitled.
 *
 * The model and prompt are the `session.title` task's — the house gateway's cheap model unless
 * the operator pinned another. Never the session's own, which may be BYOK or expensive; a title
 * is worth neither.
 */
const titleSession = async (
  db: DB,
  row: AgentSessionRow,
  request: AgentTurnRequest
): Promise<void> => {
  try {
    const [{ fallbackSessionTitle, generateSessionTitle }] = await Promise.all([
      import("@chia/agent-runtime/pi/title"),
    ]);
    const task = await resolveAgentTask(db, AGENT_TASK_IDS.sessionTitle);
    const generated = await generateSessionTitle({
      models: task.models,
      model: task.model,
      text: request.text,
      systemPrompt: task.systemPrompt,
      ...task.params,
      signal: AbortSignal.timeout(SESSION_TITLE_TIMEOUT_MS),
      onUsage: (usage) =>
        recordAgentUsage(db, {
          userId: row.userId,
          sessionId: row.id,
          runId: request.runId,
          kind: row.kind,
          source: "title",
          ...usage,
        }),
    });
    const title = generated ?? fallbackSessionTitle(request.text);
    if (title) await setAgentSessionTitleIfUnset(db, row.id, title);
  } catch {
    // Cosmetic; the turn must not fail for it.
  }
};

// ============================================
// Step
// ============================================

export const runAgentTurnStep = async (
  request: AgentTurnRequest
): Promise<AgentTurnOutcome> => {
  "use step";

  const db = await connectDatabase(undefined, { withCache: false });

  const row = await getAgentSession(db, request.sessionId);
  if (!row || row.deletedAt !== null) {
    throw new FatalError(`Unknown agent session: ${request.sessionId}`);
  }
  if (row.userId !== request.userId) {
    throw new FatalError(
      `Agent session ${request.sessionId} does not belong to the caller.`
    );
  }

  const definition = await agentFactory.load(row.kind);
  if (!definition) {
    throw new FatalError(`No agent kind registered as "${row.kind}".`);
  }

  // Recorded before the first event of this turn is written. The previous turn flushed its writer
  // before returning, so the tail is the last index it wrote.
  const { workflowRunId } = getWorkflowMetadata();
  const run = getRun(workflowRunId);
  const [seqBefore, coarseTail, deltaTail] = await Promise.all([
    getAgentSessionLastSeq(db, request.sessionId),
    run.getReadable().getTailIndex(),
    run.getReadable({ namespace: AGENT_DELTA_NAMESPACE }).getTailIndex(),
  ]);
  const marker: AgentTurnMarker = {
    seqBefore,
    streamIndex: coarseTail + 1,
    deltaStreamIndex: deltaTail + 1,
    running: true,
  };
  await patchAgentRunMetadata(db, request.runId, { [AGENT_TURN_KEY]: marker });

  const clearMarker = () =>
    patchAgentRunMetadata(db, request.runId, {
      [AGENT_TURN_KEY]: { ...marker, running: false },
    });
  const abort = subscribeAgentAbort(request.abortController.runId);
  const writer = createEventWriter(
    needsTitle(row, request) ? titleSession(db, row, request) : undefined
  );
  try {
    const outcome = await runKindTurn(
      definition,
      db,
      row,
      request,
      abort.signal,
      writer
    );
    abort.dispose();
    await clearMarker();
    return outcome;
  } catch (error) {
    abort.dispose();
    // The handler's error is the one that matters; a failed cleanup must not replace it.
    await clearMarker().catch(() => undefined);
    throw error;
  }
};

/**
 * Resolves what every kind's turn needs — the kind state, the opened session tree, the caller's
 * credential-bearing models and the approved call ids — then hands the turn to the kind.
 *
 * The runtime is imported here rather than at module scope: this step is registered at boot for
 * every process that hosts the workflow, and the runtime carries the provider stack.
 */
async function runKindTurn(
  definition: AgentKindDefinition<unknown, object>,
  db: DB,
  row: AgentSessionRow,
  request: AgentTurnRequest,
  signal: AbortSignal,
  writer: EventWriter
): Promise<AgentTurnOutcome> {
  const [{ createAgentModels }, { PgSessionRepo }] = await Promise.all([
    import("@chia/agent-runtime/models"),
    import("@chia/agent-runtime/session/pg-repo"),
  ]);

  const state = await definition.state.load(db, request.sessionId);
  if (state === null) {
    throw new FatalError(
      `Kind state is missing for agent session ${request.sessionId}.`
    );
  }
  // Read per turn, not per session: an edit in the dashboard reaches the next turn.
  const { config } = await loadKindConfig(db, definition);
  if (!row.providerId || !row.modelId || !row.thinkingLevel) {
    throw new FatalError(
      `Agent session ${request.sessionId} has incomplete LLM settings.`
    );
  }

  const repo = new PgSessionRepo(db, {
    kind: definition.kind,
    defaults: definition.defaults,
  });
  const session = await repo.openById(request.sessionId);

  const approvedToolCallIds = new Set(
    await getApprovedAgentToolCallIds(db, request.sessionId)
  );

  /**
   * Built here, per turn, because it closes over the operator's own keys.
   *
   * A `Models` carrying BYOK credentials cannot be a process-wide singleton — it belongs to whoever
   * sent this message. Providers with no credential are simply not registered, so choosing an
   * OpenAI model without an OpenAI key fails as "unknown model" rather than quietly billing the
   * house gateway account.
   */
  const models = createAgentModels(
    decryptAgentCredentials(request.credentials)
  );

  if (!definition.runTurn) {
    throw new FatalError(
      `Agent kind "${definition.kind}" has no workflow executor.`
    );
  }
  return await definition.runTurn({
    db,
    row,
    state,
    config,
    settings: {
      providerId: row.providerId,
      modelId: row.modelId,
      thinkingLevel:
        /* SAFETY: The producer contract guarantees this value satisfies ThinkingLevel. */ row.thinkingLevel as ThinkingLevel,
      activeToolNames: row.activeToolNames,
      autoApprove:
        /* SAFETY: The producer contract guarantees this value satisfies ToolTier[]. */ row.autoApprove as ToolTier[],
    },
    session,
    models,
    message: {
      text: request.text,
      template: request.template,
      decision: request.decision,
    },
    signal,
    approvedToolCallIds,
    preAuthorizedToolNames: new Set(request.preAuthorizeToolNames ?? []),
    onEvent: writer.push,
    flushEvents: writer.flush,
    onUsage: (report) =>
      recordAgentUsage(db, {
        userId: row.userId,
        sessionId: row.id,
        runId: request.runId,
        kind: row.kind,
        ...report,
      }),
    toApproval: (approval): AgentApprovalRequestSnapshot => ({
      toolCallId: approval.toolCallId,
      toolName: approval.toolName,
      // SAFETY: tool arguments passed their registered TypeBox schema before execution.
      args: approval.args as JsonObject | undefined,
    }),
    persistApprovals: async (approvals) => {
      await recordAgentApprovalRequests(
        db,
        approvals.map((approval) => ({
          sessionId: request.sessionId,
          toolCallId: approval.toolCallId,
          toolName: approval.toolName,
          args: approval.args,
        }))
      );
    },
  });
}

/**
 * No retries.
 *
 * A turn is not replayable: by the time it fails it may already have written to the draft buffer,
 * appended to the session tree, or (with `autoApprove`) committed to the database. Re-running it
 * would duplicate those effects. pi already retries the *provider* request internally, which is
 * where transient failures actually live, so a step-level retry buys nothing and risks a lot.
 *
 * The failure surfaces as `run_failed` plus an `error` event; the operator re-prompts, and pi
 * rebuilds context from whatever the partial turn persisted.
 */
runAgentTurnStep.maxRetries = 0;

// ============================================
// Event writing
// ============================================

interface EventWriter {
  push: (event: AgentWireEvent) => void;
  /**
   * Awaits every pending write. Deliberately does **not** close the streams: a session's run
   * executes many turns, and closing after the first would leave the rest with nowhere to write.
   * `closeAgentStreamsStep` closes them once, when the session's run ends.
   */
  flush: () => Promise<void>;
}

/**
 * Buffers wire events and writes them to the run's durable streams.
 *
 * Coarse events go to the default stream one at a time (they are few and each one matters for
 * replay). Deltas are batched into arrays on a separate namespace — thousands of individual durable
 * writes per turn would dominate the turn's cost.
 *
 * `holdEnd` delays the write of `run:end` — the turn's last coarse event, and the client's cue to
 * refresh — until it settles, so work that must be visible at turn end (the session title) is.
 */
const createEventWriter = (holdEnd?: Promise<unknown>): EventWriter => {
  const coarse = getWritable<AgentWireEvent>().getWriter();
  const deltas = getWritable<AgentWireEvent[]>({
    namespace: AGENT_DELTA_NAMESPACE,
  }).getWriter();

  let deltaBatch: AgentWireEvent[] = [];
  let lastFlush = Date.now();
  const inFlight: Promise<unknown>[] = [];

  const flushDeltas = () => {
    if (deltaBatch.length === 0) return;
    const batch = deltaBatch;
    deltaBatch = [];
    lastFlush = Date.now();
    inFlight.push(deltas.write(batch));
  };

  return {
    push(event) {
      if (event.type === "assistant:delta") {
        deltaBatch.push(event);
        if (Date.now() - lastFlush >= DELTA_FLUSH_MS) flushDeltas();
        return;
      }
      // A coarse event marks a boundary, so anything buffered before it must land first to keep
      // the two streams consistent with each other.
      flushDeltas();
      inFlight.push(
        event.type === "run:end" && holdEnd
          ? holdEnd.then(() => coarse.write(event))
          : coarse.write(event)
      );
    },
    async flush() {
      flushDeltas();
      await Promise.allSettled(inFlight);
      coarse.releaseLock();
      deltas.releaseLock();
    },
  };
};

/**
 * Closes the session's streams. Called once when the session's workflow run is ending, so clients
 * tailing the stream see a clean end instead of hanging.
 */
export const closeAgentStreamsStep = async (): Promise<void> => {
  "use step";

  const coarse = getWritable<AgentWireEvent>().getWriter();
  const deltas = getWritable<AgentWireEvent[]>({
    namespace: AGENT_DELTA_NAMESPACE,
  }).getWriter();

  await Promise.allSettled([coarse.close(), deltas.close()]);
};

/**
 * Marks the durable run inactive once its orchestration loop ends — `failed` when a step threw
 * out of it — and closes its abort controller so it does not sit parked until its TTL.
 */
export const completeAgentRunStep = async (
  runId: string,
  abortController: AgentAbortControllerRef,
  status: "completed" | "failed"
): Promise<void> => {
  "use step";

  const db = await connectDatabase(undefined, { withCache: false });
  // This run's row only: a run cancelled and replaced must not close its successor.
  await completeAgentRun(db, runId, status);
  await signalAgentAbort(abortController.id, "run finished");
};
