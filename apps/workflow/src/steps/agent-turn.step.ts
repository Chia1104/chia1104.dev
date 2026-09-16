import "zod/compile";
import { FatalError, getWorkflowMetadata, getWritable } from "workflow";
import { getRun } from "workflow/api";

import { loadKindConfig } from "@chia/agent-host/config";
import {
  AGENT_DELTA_NAMESPACE,
  AGENT_TURN_KEY,
} from "@chia/agent-host/execution";
import type { AgentTurnMarker } from "@chia/agent-host/execution";
import type { AgentKindExecutor } from "@chia/agent-host/kind";
import { AGENT_TASK_IDS, resolveAgentTask } from "@chia/agent-host/tasks";
import { recordAgentUsage, sessionUsageListener } from "@chia/agent-host/usage";
import type {
  AgentSessionSettings,
  AgentTurnExecution,
} from "@chia/agent-runtime/types";
import type { OperatorDecision } from "@chia/agent-runtime/wire/operator-decision";
import type {
  AgentAttachment,
  AgentWireEvent,
} from "@chia/agent-runtime/wire/schema";
import type { DB } from "@chia/db/client";
import { connectDatabase } from "@chia/db/client";
import {
  claimAgentRunTurn,
  completeAgentRun,
  consumeAgentApproval,
  getAgentSession,
  getAgentSessionLastSeq,
  listUnspentAgentApprovalKeys,
  patchAgentRunMetadata,
  recordAgentApprovalRequest,
  setAgentSessionTitleIfUnset,
} from "@chia/db/repos/agent";
import type { AgentRunStatus } from "@chia/db/schema";
import { logger } from "@chia/observability/logger";
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
 * The engine lives in this step, not the workflow: `"use workflow"` has no Node built-ins
 * and no native `fetch`; the engine needs `pg` and outbound HTTP.
 */

const DELTA_FLUSH_MS = 80;

export interface AgentTurnRequest {
  sessionId: string;
  /** Marker writes go here only; a cancelled run must not reach its successor. */
  runId: string;
  /** Verified at the transport boundary before the run started. */
  userId: string;
  /** Subscribed for the harness `AbortSignal`. */
  abortController: AgentAbortControllerRef;
  text: string;
  template?: { name: string; args?: string[] };
  attachments?: AgentAttachment[];
  decision?: OperatorDecision;
  /** Encrypted operator keys; omitted means the house gateway. */
  credentials?: EncryptedAgentCredentials;
}

export interface AgentTurnOutcome {
  status: AgentTurnExecution["status"];
}

type AgentSessionRow = NonNullable<Awaited<ReturnType<typeof getAgentSession>>>;

/** Bounds both the model call and how long `run:end` is held back for the title to land. */
const SESSION_TITLE_TIMEOUT_MS = 8_000;

const needsTitle = (row: AgentSessionRow, request: AgentTurnRequest) =>
  row.title === null && request.decision === undefined;

/**
 * Names the session from its first prompt, started before the turn and awaited before `run:end`.
 * Write is a no-op if the title is already set. Never throws. Uses the `session.title` task,
 * not the session model (may be BYOK or expensive).
 */
const titleSession = async (
  db: DB,
  row: AgentSessionRow,
  request: AgentTurnRequest
): Promise<void> => {
  try {
    const { fallbackSessionTitle, generateSessionTitle } =
      await import("@chia/agent-runtime/pi/title");
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
          credentialSource: "house",
          ...usage,
        }),
    });
    const title = generated ?? fallbackSessionTitle(request.text);
    if (title) await setAgentSessionTitleIfUnset(db, row.id, title);
  } catch {
    // Cosmetic; the turn must not fail for it.
  }
};

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

  // Before this turn's first event. The previous turn flushed, so the tail is the last index it wrote.
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
    claimed: true,
  };
  // One transaction under the session lock: the run must still be the session's active one,
  // then the marker lands and the workflow run id is bound. The executor is the one party that
  // always holds both ids, so a `prompt` whose bind failed after the start is repaired here. A
  // run that was cancelled, failed or replaced meanwhile executes nothing.
  const claimed = await claimAgentRunTurn(db, {
    sessionId: request.sessionId,
    runId: request.runId,
    externalRunId: workflowRunId,
    turnKey: AGENT_TURN_KEY,
    marker,
  });
  if (!claimed) {
    throw new FatalError(
      `Agent run ${request.runId} no longer holds session ${request.sessionId}.`
    );
  }

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
    // A thrown step ends the run and `completeAgentRunStep` closes the row. The marker is not
    // cleared here so the session never reads as idle while the run is still winding down.
    throw error;
  }
};

/**
 * Runtime is imported here, not at module scope: this step is registered at boot, and the
 * runtime carries the provider stack.
 */
async function runKindTurn(
  definition: AgentKindExecutor<unknown, object>,
  db: DB,
  row: AgentSessionRow,
  request: AgentTurnRequest,
  signal: AbortSignal,
  writer: EventWriter
): Promise<AgentTurnOutcome> {
  const [
    { accessOf, createAgentModels },
    { PgSessionRepo, settingsFromRow },
    { runPiTurn },
  ] = await Promise.all([
    import("@chia/agent-runtime/models"),
    import("@chia/agent-runtime/session/pg-repo"),
    import("@chia/agent-runtime/pi/turn"),
  ]);

  // Independent reads on the pooled client, not a lock transaction, so they go out together.
  const [state, { config, defaults }, unspentApprovalKeys] = await Promise.all([
    definition.state.load(db, request.sessionId),
    // Read per turn, not per session: an edit in the dashboard reaches the next turn.
    loadKindConfig(db, definition),
    listUnspentAgentApprovalKeys(db, request.sessionId),
  ]);
  if (state === null) {
    throw new FatalError(
      `Kind state is missing for agent session ${request.sessionId}.`
    );
  }
  // An incomplete row fails the same way on every attempt, so it must not read as retryable.
  let settings: AgentSessionSettings;
  try {
    settings = settingsFromRow(row);
  } catch (error) {
    throw new FatalError(
      error instanceof Error ? error.message : String(error)
    );
  }

  /**
   * Per turn: closes over this operator's keys. Not a process singleton.
   * Providers without a credential are unregistered, so a missing key fails as "unknown model"
   * instead of billing the house gateway.
   */
  const credentials = decryptAgentCredentials(request.credentials);
  const models = createAgentModels(credentials);
  // Before the kind prepares the turn: a model the caller may not run costs no further query.
  const model = definition.models.resolve(
    settings,
    models,
    accessOf(credentials),
    defaults
  );
  // The compaction task may be pinned to a house model; the session's own is its default.
  const compaction = await resolveAgentTask(
    db,
    AGENT_TASK_IDS.sessionCompaction,
    { session: () => ({ model, models, credentials }) }
  );

  const session = new PgSessionRepo(db, definition.kind).open(row);
  const approvedApprovalKeys = new Set(unspentApprovalKeys);

  const { settle, ...plan } = await definition.prepareTurn({
    db,
    row,
    state,
    config,
    settings,
  });
  const execution = await runPiTurn({
    ...plan,
    agentSessionId: row.id,
    agentRunId: request.runId,
    session,
    settings,
    model,
    models,
    compaction: { model: compaction.model, models: compaction.models },
    policy: definition.policy,
    message: {
      text: request.text,
      template: request.template,
      attachments: request.attachments,
      decision: request.decision,
    },
    signal,
    approvedApprovalKeys,
    consumeApproval: (key) => consumeAgentApproval(db, request.sessionId, key),
    onEvent: writer.push,
    flushEvents: writer.flush,
    onUsage: sessionUsageListener(db, {
      userId: row.userId,
      sessionId: row.id,
      runId: request.runId,
      kind: row.kind,
      credentialsFor: (source) =>
        source === "compaction" ? compaction.credentials : credentials,
    }),
    persistApproval: (approval) =>
      recordAgentApprovalRequest(db, {
        sessionId: request.sessionId,
        toolCallId: approval.toolCallId,
        toolName: approval.toolName,
        approvalKey: approval.key,
        // SAFETY: tool arguments passed their registered TypeBox schema before execution.
        args: approval.args as JsonObject | undefined,
      }),
  });
  await settle?.(execution);
  return { status: execution.status };
}

/**
 * A turn is not replayable: it may already have written the draft, session tree, or DB.
 * pi retries the provider request internally.
 */
runAgentTurnStep.maxRetries = 0;

interface EventWriter {
  push: (event: AgentWireEvent) => void;
  /**
   * Awaits pending writes. Does not close the streams: a run has many turns.
   * `closeAgentStreamsStep` closes them when the run ends.
   */
  flush: () => Promise<void>;
}

/**
 * Coarse events go to the default stream one at a time. Deltas are batched on a separate
 * namespace: thousands of durable writes would dominate the turn's cost.
 * `holdEnd` delays `run:end` until it settles (session title).
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
      // Coarse events are a stream boundary; flush buffered deltas first.
      flushDeltas();
      inFlight.push(
        event.type === "run:end" && holdEnd
          ? holdEnd.then(() => coarse.write(event))
          : coarse.write(event)
      );
    },
    async flush() {
      flushDeltas();
      // A lost write does not fail the turn: its side effects and entries are already durable
      // and a client that misses the event reloads the session. It is logged so a stall can be traced.
      const lost = (await Promise.allSettled(inFlight)).filter(
        (result) => result.status === "rejected"
      );
      if (lost.length > 0) {
        logger.error(
          { err: lost[0]?.reason, count: lost.length },
          "Agent stream writes failed"
        );
      }
      coarse.releaseLock();
      deltas.releaseLock();
    },
  };
};

/** Closes streams once the session run is ending, so tailing clients see a clean end. */
export const closeAgentStreamsStep = async (): Promise<void> => {
  "use step";

  const coarse = getWritable<AgentWireEvent>().getWriter();
  const deltas = getWritable<AgentWireEvent[]>({
    namespace: AGENT_DELTA_NAMESPACE,
  }).getWriter();

  await Promise.allSettled([coarse.close(), deltas.close()]);
};

/** Marks the run inactive and closes its abort controller so it does not sit parked until TTL. */
export const completeAgentRunStep = async (
  runId: string,
  abortController: AgentAbortControllerRef,
  status: Exclude<AgentRunStatus, "active">
): Promise<void> => {
  "use step";

  const db = await connectDatabase(undefined, { withCache: false });
  // This run's row only: a run cancelled and replaced must not close its successor.
  await completeAgentRun(db, runId, status);
  await signalAgentAbort(abortController.id, "run finished");
};
