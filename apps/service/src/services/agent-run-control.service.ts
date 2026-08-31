import { getHookByToken, getRun } from "workflow/api";

import {
  AGENT_DELTA_NAMESPACE,
  AGENT_TURN_KEY,
} from "@chia/agent-host/execution";
import type {
  AgentStreamPosition,
  AgentTurnMarker,
} from "@chia/agent-host/execution";
import type { AgentWireEvent } from "@chia/agent-runtime/wire/schema";
import type { AgentStreamCursor } from "@chia/api/orpc/services/agent.service";
import type { DB } from "@chia/db/client";
import {
  getAgentSessionLastSeq,
  patchAgentRunMetadata,
} from "@chia/db/repos/agent";

import { workflowControl } from "../repos/workflow-control.repo";

import { isRunLive } from "./agent-run-liveness.service";

interface ClaimableAgentTurn {
  id: string;
  activeRunId: string | null;
  turn: AgentTurnMarker | undefined;
}

const cursorOf = (
  runId: string,
  position: AgentStreamPosition
): AgentStreamCursor => ({
  runId,
  startIndex: position.streamIndex,
  deltaStartIndex: position.deltaStreamIndex,
});

/** A cursor at a known stream position, used for the first turn of a newly started run. */
export const agentStreamCursor = cursorOf;

/**
 * Captures and claims the next turn before its workflow hook is resumed.
 *
 * Reading both tails and writing the marker are one operation so callers cannot resume a hook with
 * a cursor they forgot to claim. A turn already running keeps its marker: the queued turn follows
 * it in durable stream order and the step replaces the marker when that turn begins.
 */
export const claimNextAgentTurn = async (
  db: DB,
  row: ClaimableAgentTurn,
  runId: string
): Promise<AgentStreamCursor> => {
  const run = getRun(runId);
  const [coarseTail, deltaTail] = await Promise.all([
    run.getReadable().getTailIndex(),
    run.getReadable({ namespace: AGENT_DELTA_NAMESPACE }).getTailIndex(),
  ]);
  const position: AgentStreamPosition = {
    streamIndex: coarseTail + 1,
    deltaStreamIndex: deltaTail + 1,
  };

  if (row.activeRunId && !row.turn?.running) {
    await patchAgentRunMetadata(db, row.activeRunId, {
      [AGENT_TURN_KEY]: {
        seqBefore: await getAgentSessionLastSeq(db, row.id),
        ...position,
        running: true,
      } satisfies AgentTurnMarker,
    });
  }

  return cursorOf(runId, position);
};

/**
 * `createHook()` registers after the workflow starts, so a just-started run may not be resumable
 * yet. This turns that startup race into a retryable response.
 */
export const isAgentHookReady = async (token: string): Promise<boolean> => {
  try {
    return Boolean(await getHookByToken(token));
  } catch {
    return false;
  }
};

const ABORT_SETTLE_TIMEOUT_MS = 10_000;

/** Waits for a stopped turn to persist its terminal event before the run is cancelled. */
export const waitForAgentTurnEnd = async (
  runId: string,
  startIndex: number
): Promise<void> => {
  const reader = getRun(runId)
    .getReadable<AgentWireEvent>({ startIndex })
    .getReader();
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
    // A dropped stream has nothing more to tell; cancellation proceeds as before.
  } finally {
    clearTimeout(deadline);
    await reader.cancel().catch(() => undefined);
  }
};

/** Cancels a run unless it reached a terminal state during the request. */
export const cancelLiveAgentRun = async (runId: string): Promise<void> => {
  try {
    await workflowControl.cancelRun(runId);
  } catch (error) {
    if (await isRunLive(runId)) throw error;
  }
};

interface AgentRunStreamOptions {
  runId: string;
  startIndex?: number;
  deltaStartIndex?: number;
}

/**
 * Tails the durable coarse stream and, when requested, merges its batched delta namespace in arrival
 * order. Both readers are cancelled when the consumer disconnects.
 */
export async function* streamAgentRunEvents({
  runId,
  startIndex,
  deltaStartIndex,
}: AgentRunStreamOptions): AsyncGenerator<AgentWireEvent, void, void> {
  const reader = getRun(runId)
    .getReadable<AgentWireEvent>({ startIndex })
    .getReader();
  const deltaReader =
    deltaStartIndex === undefined
      ? undefined
      : getRun(runId)
          .getReadable<AgentWireEvent[]>({
            namespace: AGENT_DELTA_NAMESPACE,
            startIndex: deltaStartIndex,
          })
          .getReader();

  try {
    if (!deltaReader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        if (value) yield value;
      }
    }

    const never = new Promise<never>(() => undefined);
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
          coarsePending = never;
        } else {
          if (winner.result.value) yield winner.result.value;
          coarsePending = reader.read();
        }
      } else if (winner.result.done) {
        deltaDone = true;
        deltaPending = never;
      } else {
        for (const event of winner.result.value ?? []) yield event;
        deltaPending = deltaReader.read();
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    await deltaReader?.cancel().catch(() => undefined);
  }
}
