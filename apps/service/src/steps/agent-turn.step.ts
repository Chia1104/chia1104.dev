import { FatalError, getWorkflowMetadata, getWritable } from "workflow";
import { getRun } from "workflow/api";
import * as z from "zod";

import type {
  AgentTurnError,
  ThinkingLevel,
  ToolTier,
} from "@chia/agent-runtime/types";
import type { AgentWireEvent } from "@chia/agent-runtime/wire/schema";
import type { DB } from "@chia/db/client";
import { connectDatabase } from "@chia/db/client";
import type { JsonObject } from "@chia/db/json";
import {
  completeActiveAgentRuns,
  getAgentSession,
  getApprovedAgentToolCallIds,
  getWritingAgentSession,
  patchAgentRunMetadata,
  recordAgentApprovalRequests,
} from "@chia/db/repos/agent";
import { getAdminId } from "@chia/utils/config";

import {
  signalAgentAbort,
  subscribeAgentAbort,
} from "../services/agent-abort-controller";
import { createAgentContentPort } from "../services/agent-content.port";
import { decryptAgentCredentials } from "../services/agent-credentials";
import type { AgentAbortControllerRef } from "../workflows/hooks/agent.hooks";
import type { EncryptedAgentCredentials } from "../workflows/hooks/agent.hooks";

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
export const AGENT_DELTA_NAMESPACE = "agent:deltas";

/** Flush window for batching deltas, in milliseconds. */
const DELTA_FLUSH_MS = 80;

// ============================================
// Turn marker
// ============================================

/**
 * The turn the run is on, kept in `agent_run.metadata` because the workflow SDK cannot say it: a
 * run parked on its message hook is `running` just like one executing a step. `running` here is
 * true only while the turn step is inside its handler. `leafEntryId`/`streamIndex` say where the
 * turn began, so a client can rejoin it: `get` cuts the replayed transcript after that leaf and
 * `attach` tails the run's stream from that index — both off one marker, so the join never
 * duplicates or drops a message.
 */
export const AGENT_TURN_KEY = "turn";

export interface AgentTurnMarker extends JsonObject {
  /** Active leaf before this turn appended anything; `null` for an empty session. */
  leafEntryId: string | null;
  /** First coarse stream index this turn writes to. */
  streamIndex: number;
  running: boolean;
}

const agentTurnMarkerSchema = z.object({
  leafEntryId: z.string().nullable(),
  streamIndex: z.number(),
  running: z.boolean(),
});

export const readAgentTurnMarker = (metadata: JsonObject) =>
  agentTurnMarkerSchema.safeParse(metadata[AGENT_TURN_KEY]).data;

// ============================================
// Step contract
// ============================================

export interface AgentTurnRequest {
  sessionId: string;
  /** Verified at the transport boundary before the run was started. */
  userId: string;
  /** The run's abort controller; the turn subscribes to it for the harness's `AbortSignal`. */
  abortController: AgentAbortControllerRef;
  text: string;
  template?: { name: string; args?: string[] };
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

type AgentTurnHandler = (
  db: DB,
  row: AgentSessionRow,
  request: AgentTurnRequest,
  signal: AbortSignal
) => Promise<AgentTurnOutcome>;

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

  const handler = AGENT_TURN_HANDLERS.get(row.kind);
  if (!handler) {
    throw new FatalError(
      `No turn handler registered for agent kind "${row.kind}".`
    );
  }

  // Recorded before the first event of this turn is written. The previous turn flushed its writer
  // before returning, so the tail is the last index it wrote.
  const { workflowRunId } = getWorkflowMetadata();
  const marker: AgentTurnMarker = {
    leafEntryId: row.leafEntryId,
    streamIndex: (await getRun(workflowRunId).getReadable().getTailIndex()) + 1,
    running: true,
  };
  await patchAgentRunMetadata(db, workflowRunId, { [AGENT_TURN_KEY]: marker });

  const clearMarker = () =>
    patchAgentRunMetadata(db, workflowRunId, {
      [AGENT_TURN_KEY]: { ...marker, running: false },
    });
  const abort = subscribeAgentAbort(request.abortController.runId);
  try {
    const outcome = await handler(db, row, request, abort.signal);
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
 * Static registration is intentional: workflow steps are deployment-versioned bundles. A new kind
 * adds a handler here and a sibling HTTP runtime, while the workflow stays free of domain imports.
 *
 * Keyed by the literal rather than `WRITING_AGENT_KIND`, because importing that constant pulls
 * `@chia/agent-writing` and the whole provider stack behind it. This module is registered at boot
 * for every process that hosts the workflow, so a domain import here is an eager one. The key is
 * matched against `agent_session.kind`, which is a database string either way; the handler asserts
 * the constant once its domain module is loaded.
 */
const AGENT_TURN_HANDLERS = new Map<string, AgentTurnHandler>([
  ["writing", runWritingAgentTurn],
]);

async function runWritingAgentTurn(
  db: DB,
  row: AgentSessionRow,
  request: AgentTurnRequest,
  signal: AbortSignal
): Promise<AgentTurnOutcome> {
  const [
    { createAgentModels },
    { PgSessionRepo },
    { PgDraftStore },
    { runWritingTurn },
    { WRITING_AGENT_KIND, WRITING_SESSION_DEFAULTS },
    // Constructs the Firecrawl client at module scope, so it must stay off the boot path.
    { createAgentWebPort },
  ] = await Promise.all([
    import("@chia/agent-runtime/models"),
    import("@chia/agent-runtime/session/pg-repo"),
    import("@chia/agent-writing/draft/pg-draft-store"),
    import("@chia/agent-writing/runtime"),
    import("@chia/agent-writing/models"),
    import("../services/agent-web.port"),
  ]);

  if (row.kind !== WRITING_AGENT_KIND) {
    throw new FatalError(
      `Agent session ${request.sessionId} dispatched to the writing turn as kind "${row.kind}".`
    );
  }

  const writingState = await getWritingAgentSession(db, request.sessionId);
  if (!writingState) {
    throw new FatalError(
      `Writing state is missing for agent session ${request.sessionId}.`
    );
  }
  if (!row.providerId || !row.modelId || !row.thinkingLevel) {
    throw new FatalError(
      `Writing session ${request.sessionId} has incomplete LLM settings.`
    );
  }

  const repo = new PgSessionRepo(db, {
    kind: WRITING_AGENT_KIND,
    defaults: WRITING_SESSION_DEFAULTS,
  });
  const session = await repo.openById(request.sessionId);
  const draft = new PgDraftStore(db);
  /**
   * The writing agent acts as the configured author. The kind's `minTier` is `Root`, which pins
   * session ownership to that same id, so this states whose posts the port touches rather than
   * performing a second authorization check.
   */
  const content = createAgentContentPort({ db, adminId: getAdminId() });
  const web = createAgentWebPort();

  const approvedToolCallIds = new Set(
    await getApprovedAgentToolCallIds(db, request.sessionId)
  );

  const writer = createEventWriter();

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

  return await runWritingTurn({
    session,
    models,
    settings: {
      providerId: row.providerId,
      modelId: row.modelId,
      thinkingLevel:
        /* SAFETY: The producer contract guarantees this value satisfies ThinkingLevel. */ row.thinkingLevel as ThinkingLevel,
      activeToolNames: row.activeToolNames,
      autoApprove:
        /* SAFETY: The producer contract guarantees this value satisfies ToolTier[]. */ row.autoApprove as ToolTier[],
    },
    agentSessionId: request.sessionId,
    targetFeedId: writingState.targetFeedId ?? undefined,
    content,
    web,
    draft,
    onEvent: writer.push,
    approvedToolCallIds,
    preAuthorizedToolNames: new Set(request.preAuthorizeToolNames ?? []),
    signal,
    message: {
      text: request.text,
      template: request.template,
    },
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
    flushEvents: writer.flush,
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
 */
const createEventWriter = (): EventWriter => {
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
      inFlight.push(coarse.write(event));
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
 * Marks the durable run inactive once its orchestration loop ends, and closes its abort controller
 * so it does not sit parked until its TTL.
 */
export const completeAgentRunStep = async (
  sessionId: string,
  abortController: AgentAbortControllerRef
): Promise<void> => {
  "use step";

  const db = await connectDatabase(undefined, { withCache: false });
  await completeActiveAgentRuns(db, sessionId, "completed");
  await signalAgentAbort(abortController.id, "run finished");
};
