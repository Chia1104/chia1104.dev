import { FatalError, getWritable } from "workflow";

import { PgPendingMessageStore, PgSessionRepo } from "@chia/agent-core";
import type { AgentWireEvent, ThinkingLevel, ToolTier } from "@chia/agent-core";
import {
  createWritingHarness,
  PgDraftStore,
  WRITING_AGENT_KIND,
  WRITING_SESSION_DEFAULTS,
} from "@chia/agent-writing";
import type { DB } from "@chia/db";
import { connectDatabase } from "@chia/db/client";
import {
  completeActiveAgentRuns,
  getAgentSession,
  getApprovedAgentToolCallIds,
  getWritingAgentSession,
  recordAgentApprovalRequest,
} from "@chia/db/repos/agent";

import { createAgentContentPort } from "../services/agent-content.port";

/**
 * One agent turn, as a durable step.
 *
 * The harness **must** live here rather than in the workflow function: `"use workflow"` code runs in
 * a sandboxed VM with no Node built-ins and no native `fetch`, and the harness needs `pg` (drizzle)
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
// Step contract
// ============================================

export interface AgentTurnRequest {
  sessionId: string;
  /** Verified at the transport boundary before the run was started. */
  adminId: string;
  userId: string;
  text: string;
  template?: { name: string; args?: string[] };
  preAuthorizeToolNames?: string[];
}

export interface AgentApprovalRequestSnapshot {
  toolCallId: string;
  toolName: string;
  args?: Record<string, unknown>;
}

export interface AgentTurnOutcome {
  status: "done" | "awaiting_approval" | "error";
  approvals: AgentApprovalRequestSnapshot[];
  error?: string;
}

type AgentSessionRow = NonNullable<Awaited<ReturnType<typeof getAgentSession>>>;

type AgentTurnHandler = (
  db: DB,
  row: AgentSessionRow,
  request: AgentTurnRequest
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

  const handler = AGENT_TURN_HANDLERS[row.kind];
  if (!handler) {
    throw new FatalError(
      `No turn handler registered for agent kind "${row.kind}".`
    );
  }

  return await handler(db, row, request);
};

/**
 * Static registration is intentional: workflow steps are deployment-versioned bundles. A new kind
 * adds a handler here and a sibling HTTP runtime, while the workflow stays free of domain imports.
 */
const AGENT_TURN_HANDLERS: Readonly<Record<string, AgentTurnHandler>> = {
  [WRITING_AGENT_KIND]: runWritingAgentTurn,
};

async function runWritingAgentTurn(
  db: DB,
  row: AgentSessionRow,
  request: AgentTurnRequest
): Promise<AgentTurnOutcome> {
  const kv = await import("@chia/kv/redis").then((module) =>
    module.getRedisKv()
  );
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
  const pending = new PgPendingMessageStore(db);
  const content = createAgentContentPort({ db, kv, adminId: request.adminId });

  const approvedToolCallIds = new Set(
    await getApprovedAgentToolCallIds(db, request.sessionId)
  );

  const writer = createEventWriter();

  const built = await createWritingHarness({
    session,
    settings: {
      providerId: row.providerId,
      modelId: row.modelId,
      thinkingLevel: row.thinkingLevel as ThinkingLevel,
      activeToolNames: row.activeToolNames,
      autoApprove: row.autoApprove as ToolTier[],
    },
    agentSessionId: request.sessionId,
    adminId: request.adminId,
    targetFeedId: writingState.targetFeedId ?? undefined,
    content,
    draft,
    pending,
    onEvent: writer.push,
    approvedToolCallIds,
    preAuthorizedToolNames: new Set(request.preAuthorizeToolNames ?? []),
  });

  /**
   * Drains queued steer / follow-up messages while the turn runs.
   *
   * `AgentHarness.steer()` is a method, not a callback, so a message that arrives over HTTP
   * mid-turn cannot reach the harness directly. The transport writes a row and this poll hands it
   * over at pi's next queue drain point.
   */
  const drainInterval = setInterval(() => {
    void built.drainPendingMessages().catch(() => {
      // A failed drain must not kill the turn; the message stays queued for the next tick.
    });
  }, 1_000);

  writer.push({ type: "run:start", sessionId: request.sessionId });
  writer.push({
    type: "user",
    messageId: `u-${Date.now().toString(36)}`,
    text: request.text,
  });

  let failure: string | undefined;

  try {
    if (request.template) {
      await built.harness.promptFromTemplate(
        request.template.name,
        request.template.args
      );
    } else {
      await built.harness.prompt(request.text);
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  } finally {
    clearInterval(drainInterval);
  }

  // Persist every approval request before the step returns, so a decision made hours later can
  // still be matched back to its tool call.
  const approvals: AgentApprovalRequestSnapshot[] = [];
  for (const approval of built.approvalRequests) {
    const snapshot: AgentApprovalRequestSnapshot = {
      toolCallId: approval.toolCallId,
      toolName: approval.toolName,
      args: approval.args as Record<string, unknown> | undefined,
    };
    approvals.push(snapshot);
    await recordAgentApprovalRequest(db, {
      sessionId: request.sessionId,
      toolCallId: snapshot.toolCallId,
      toolName: snapshot.toolName,
      args: snapshot.args,
    });
  }

  if (failure) writer.push({ type: "error", message: failure });

  const status: AgentTurnOutcome["status"] = failure
    ? "error"
    : approvals.length > 0
      ? "awaiting_approval"
      : "done";

  writer.push({
    type: "run:end",
    reason: status === "awaiting_approval" ? "awaiting_approval" : status,
  });

  built.dispose();
  await writer.flush();

  return { status, approvals, error: failure };
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

/** Marks the durable run inactive once its orchestration loop ends. */
export const completeAgentRunStep = async (
  sessionId: string
): Promise<void> => {
  "use step";

  const db = await connectDatabase(undefined, { withCache: false });
  await completeActiveAgentRuns(db, sessionId, "completed");
};
