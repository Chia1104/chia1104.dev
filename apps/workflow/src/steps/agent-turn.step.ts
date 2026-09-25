import "zod/compile";
import { FatalError, getWorkflowMetadata, getWritable } from "workflow";
import { getRun } from "workflow/api";

import { loadKindConfig } from "@chia/agent-host/config";
import { decryptAgentCredentials } from "@chia/agent-host/credentials";
import {
  AGENT_DELTA_NAMESPACE,
  AGENT_TURN_KEY,
} from "@chia/agent-host/execution";
import type { AgentTurnMarker } from "@chia/agent-host/execution";
import type { AgentKindExecutor } from "@chia/agent-host/kind";
import { AgentTaskId, resolveAgentTask } from "@chia/agent-host/tasks";
import { recordAgentUsage, sessionUsageListener } from "@chia/agent-host/usage";
import type { AgentModel } from "@chia/agent-runtime/models";
import { AgentErrorKind } from "@chia/agent-runtime/types";
import type {
  AgentSessionSettings,
  AgentTurnExecution,
} from "@chia/agent-runtime/types";
import type { AgentWireEvent } from "@chia/agent-runtime/wire/schema";
import type { DB } from "@chia/db/client";
import { connectDatabase } from "@chia/db/client";
import {
  claimAgentRunTurn,
  completeAgentRun,
  getAgentApprovalBatch,
  getAgentSession,
  getAgentSessionLastSeq,
  patchAgentRunMetadata,
  recordAgentApprovalBatch,
  setAgentSessionTitleIfUnset,
} from "@chia/db/repos/agent";
import type { AgentRunStatus } from "@chia/db/schema";
import {
  AgentApprovalStatus,
  AgentCredentialSource,
  AgentUsageSource,
} from "@chia/db/schema";
import { logger } from "@chia/observability/logger";
import { reportError } from "@chia/observability/report";
import { signalAgentAbort } from "@chia/services/agent/abort";
import { messageOf } from "@chia/utils/error-helper";
import { asJsonObject } from "@chia/utils/json";
import type {
  AgentAbortControllerRef,
  AgentMessagePayload,
} from "@chia/workflow-control/agent-schema";

import { agentFactory } from "../agents/factory";
import { env } from "../env";
import { subscribeAgentAbort } from "../services/agent-abort-controller";
import { workflowControl } from "../services/workflow-control";

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
  /** Subscribed for the turn's `AbortSignal`. */
  abortController: AgentAbortControllerRef;
  /** A prompt, or the answers that resume a stopped turn; credentials omitted run on the house gateway. */
  message: AgentMessagePayload;
}

export interface AgentTurnOutcome {
  status: AgentTurnExecution["status"];
}

type AgentSessionRow = NonNullable<Awaited<ReturnType<typeof getAgentSession>>>;

/** Bounds both the model call and how long `run:end` is held back for the title to land. */
const SESSION_TITLE_TIMEOUT_MS = 8_000;

const needsTitle = (row: AgentSessionRow, request: AgentTurnRequest) =>
  row.title === null && request.message.type === "prompt";

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
  if (request.message.type !== "prompt") return;
  const { text } = request.message;
  try {
    const { fallbackSessionTitle, generateSessionTitle } =
      await import("@chia/agent-runtime/title");
    const task = await resolveAgentTask(db, AgentTaskId.SessionTitle);
    const generated = await generateSessionTitle({
      models: task.models,
      model: task.model,
      text,
      systemPrompt: task.systemPrompt,
      ...task.params,
      signal: AbortSignal.timeout(SESSION_TITLE_TIMEOUT_MS),
      onUsage: (usage) =>
        recordAgentUsage(db, {
          userId: row.userId,
          sessionId: row.id,
          runId: request.runId,
          kind: row.kind,
          source: AgentUsageSource.Title,
          credentialSource: AgentCredentialSource.House,
          ...usage,
        }),
    });
    const title = generated ?? fallbackSessionTitle(text);
    if (title) await setAgentSessionTitleIfUnset(db, row.id, title);
  } catch (error) {
    // Cosmetic; the turn must not fail for it.
    reportError(error, "Session title could not be set", {
      sessionId: row.id,
      runId: request.runId,
    });
  }
};

export const runAgentTurnStep = async (
  request: AgentTurnRequest
): Promise<AgentTurnOutcome> => {
  "use step";

  try {
    return await executeAgentTurn(request);
  } catch (error) {
    // The runtime reports the failures it returns; a throw is reported here, the last boundary
    // in Node: the workflow function that records it cannot log.
    reportError(error, "Agent turn step failed", {
      sessionId: request.sessionId,
      runId: request.runId,
    });
    throw error;
  }
};

const executeAgentTurn = async (
  request: AgentTurnRequest
): Promise<AgentTurnOutcome> => {
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
    { accessOf, createAgentModels, UnknownAgentModelError },
    { PgSessionRepo, settingsFromRow },
    { runTurn },
  ] = await Promise.all([
    import("@chia/agent-runtime/models"),
    import("@chia/agent-runtime/session/pg-repo"),
    import("@chia/agent-runtime/turn"),
  ]);

  const { credentials: encrypted, ...input } = request.message;
  const resume = input.type === "resume" ? input.resume : undefined;

  // Independent reads on the pooled client, not a lock transaction, so they go out together.
  const [state, { config, defaults }, batch] = await Promise.all([
    definition.state.load(db, request.sessionId),
    // Read per turn, not per session: an edit in the dashboard reaches the next turn.
    loadKindConfig(db, definition),
    resume
      ? getAgentApprovalBatch(db, request.sessionId, resume.interruptedRunId)
      : Promise.resolve([]),
  ]);
  if (state === null) {
    throw new FatalError(
      `Kind state is missing for agent session ${request.sessionId}.`
    );
  }
  // An incomplete row fails the same way on every attempt, so it must not read as retryable.
  let settings: AgentSessionSettings;
  try {
    settings = settingsFromRow(row, defaults);
  } catch (error) {
    const fatal = new FatalError(messageOf(error));
    fatal.cause = error;
    throw fatal;
  }

  /**
   * Per turn: closes over this operator's keys. Not a process singleton.
   * Providers without a credential are unregistered, so a missing key fails as "unknown model"
   * instead of billing the house gateway.
   */
  const credentials = decryptAgentCredentials(
    encrypted,
    env.AI_AUTH_PRIVATE_KEY
  );
  const models = createAgentModels(credentials);
  // Before the kind prepares the turn: a model the caller may not run costs no further query.
  let model: AgentModel;
  try {
    model = definition.models.resolve(
      settings,
      models,
      accessOf(credentials),
      defaults
    );
  } catch (error) {
    if (!(error instanceof UnknownAgentModelError)) throw error;
    // The session's pinned model left the catalogue or the caller's keys; the turn is refused
    // like any other caller-side failure, so the client can offer a different model.
    logger.warn(
      {
        sessionId: row.id,
        runId: request.runId,
        providerId: settings.providerId,
        modelId: settings.modelId,
      },
      "Agent turn refused: session model unavailable"
    );
    writer.push({ type: "error", kind: AgentErrorKind.ModelUnavailable });
    writer.push({ type: "run:end", reason: "error" });
    await writer.flush();
    return { status: "error" };
  }
  // The compaction task may be pinned to a house model; the session's own is its default.
  const compaction = await resolveAgentTask(db, AgentTaskId.SessionCompaction, {
    session: () => ({ model, models, credentials }),
  });

  const session = new PgSessionRepo(db, definition.kind).open(row);

  const { settle, ...plan } = await definition.prepareTurn({
    db,
    row,
    state,
    config,
    settings,
    approvedCalls: batch
      .filter((approval) => approval.status === AgentApprovalStatus.Approved)
      .map((approval) => ({
        toolCallId: approval.toolCallId,
        key: approval.approvalKey,
      })),
  });
  const execution = await runTurn({
    ...plan,
    ...(input.type === "resume"
      ? { resume: input.resume }
      : {
          message: {
            text: input.text,
            template: input.template,
            attachments: input.attachments,
          },
        }),
    agentSessionId: row.id,
    agentRunId: request.runId,
    session,
    settings,
    model,
    models,
    compaction: { model: compaction.model, models: compaction.models },
    policy: definition.policy,
    signal,
    onEvent: writer.push,
    flushEvents: writer.flush,
    onUsage: sessionUsageListener(db, {
      userId: row.userId,
      sessionId: row.id,
      runId: request.runId,
      kind: row.kind,
      credentialsFor: (source) =>
        source === AgentUsageSource.Compaction
          ? compaction.credentials
          : credentials,
    }),
    persistApprovals: (approvals) =>
      recordAgentApprovalBatch(db, {
        sessionId: request.sessionId,
        runId: request.runId,
        requests: approvals.requests.map((approval) => ({
          toolCallId: approval.toolCallId,
          toolName: approval.toolName,
          approvalKey: approval.key,
          args: asJsonObject(approval.args),
        })),
        settled: approvals.settled.map((call) => ({
          toolCallId: call.toolCallId,
          toolName: call.toolName,
          approvalKey: call.key,
          args: asJsonObject(call.args),
          approved: call.approved,
          reason: call.reason,
        })),
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
      // and a client that misses the event reloads the session. It is reported so a stall can be traced.
      const lost = (await Promise.allSettled(inFlight)).filter(
        (result) => result.status === "rejected"
      );
      if (lost.length > 0) {
        reportError(lost[0]?.reason, "Agent stream writes failed", {
          count: lost.length,
        });
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
  status: Exclude<AgentRunStatus, typeof AgentRunStatus.Active>
): Promise<void> => {
  "use step";

  const db = await connectDatabase(undefined, { withCache: false });
  // This run's row only: a run cancelled and replaced must not close its successor.
  await completeAgentRun(db, runId, status);
  await signalAgentAbort(workflowControl, abortController.id, "run finished");
};
