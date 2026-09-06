import { AGENT_DELTA_NAMESPACE } from "@chia/agent-host/execution";
import type { AgentStreamPosition } from "@chia/agent-host/execution";
import type { AgentWireEvent } from "@chia/agent-runtime/wire/schema";
import type { WorkflowControlClient } from "@chia/workflow-control/client";

import type { AgentRunHost } from "../agent.factory";
import type { AgentStreamCursor } from "../agent.service";

import { isRunLive } from "./run-liveness";

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

const ABORT_SETTLE_TIMEOUT_MS = 10_000;

/**
 * Waits for a stopped turn to persist its terminal event before the run is cancelled.
 * `true` when the turn ended or the run closed its streams; `false` when the deadline passed
 * or the stream dropped, in which case the step may still be executing.
 */
export const waitForAgentTurnEnd = async (
  runs: AgentRunHost,
  runId: string,
  startIndex: number
): Promise<boolean> => {
  const reader = runs
    .get(runId)
    .getReadable<AgentWireEvent>({ startIndex })
    .getReader();
  // Cancelling the reader resolves the pending read as `done`, which must not pass for the
  // run closing its stream.
  let expired = false;
  const deadline = setTimeout(() => {
    expired = true;
    void reader.cancel().catch(() => undefined);
  }, ABORT_SETTLE_TIMEOUT_MS);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return !expired;
      if (value?.type === "run:end") return true;
    }
  } catch {
    return false;
  } finally {
    clearTimeout(deadline);
    await reader.cancel().catch(() => undefined);
  }
};

/** Cancels a run unless it reached a terminal state during the request. */
export const cancelLiveAgentRun = async (
  runs: AgentRunHost,
  workflow: WorkflowControlClient,
  runId: string
): Promise<void> => {
  try {
    await workflow.cancelRun(runId);
  } catch (error) {
    if (await isRunLive(runs, runId)) throw error;
  }
};

interface AgentRunStreamOptions {
  runId: string;
  startIndex?: number;
  deltaStartIndex?: number;
}

/**
 * Tails the durable coarse stream and, when requested, merges its batched delta namespace
 * in arrival order. Both readers are cancelled when the consumer disconnects.
 */
export async function* streamAgentRunEvents({
  runs,
  runId,
  startIndex,
  deltaStartIndex,
}: AgentRunStreamOptions & {
  runs: AgentRunHost;
}): AsyncGenerator<AgentWireEvent, void, void> {
  const reader = runs
    .get(runId)
    .getReadable<AgentWireEvent>({ startIndex })
    .getReader();
  const deltaReader =
    deltaStartIndex === undefined
      ? undefined
      : runs
          .get(runId)
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
