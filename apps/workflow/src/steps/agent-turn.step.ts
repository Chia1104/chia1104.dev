import "zod/compile";
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
import { credentialSourceOf, recordAgentUsage } from "@chia/agent-host/usage";
import type {
  AgentAttachment,
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
  preAuthorizeToolNames?: string[];
  /** Encrypted operator keys; omitted means the house gateway. */
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
 * Runtime is imported here, not at module scope: this step is registered at boot, and the
 * runtime carries the provider stack.
 */
async function runKindTurn(
  definition: AgentKindDefinition<unknown, object>,
  db: DB,
  row: AgentSessionRow,
  request: AgentTurnRequest,
  signal: AbortSignal,
  writer: EventWriter
): Promise<AgentTurnOutcome> {
  const [{ accessOf, createAgentModels }, { PgSessionRepo }] =
    await Promise.all([
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
  const { config, defaults } = await loadKindConfig(db, definition);
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
   * Per turn: closes over this operator's keys. Not a process singleton.
   * Providers without a credential are unregistered, so a missing key fails as "unknown model"
   * instead of billing the house gateway.
   */
  const credentials = decryptAgentCredentials(request.credentials);
  const models = createAgentModels(credentials);

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
    access: accessOf(credentials),
    house: defaults,
    message: {
      text: request.text,
      template: request.template,
      attachments: request.attachments,
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
        credentialSource: credentialSourceOf(credentials, report.providerId),
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
      await Promise.allSettled(inFlight);
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
  status: "completed" | "failed"
): Promise<void> => {
  "use step";

  const db = await connectDatabase(undefined, { withCache: false });
  // This run's row only: a run cancelled and replaced must not close its successor.
  await completeAgentRun(db, runId, status);
  await signalAgentAbort(abortController.id, "run finished");
};
