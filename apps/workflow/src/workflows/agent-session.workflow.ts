import "zod/compile";
import * as z from "zod";

import type { AgentRunStatus } from "@chia/db/schema";
import {
  agentAbortHook,
  agentAbortToken,
} from "@chia/workflow-control/agent-hooks";
import { agentMessagePayloadSchema } from "@chia/workflow-control/agent-schema";

import {
  closeAgentStreamsStep,
  completeAgentRunStep,
  runAgentTurnStep,
} from "../steps/agent-turn.step";

/**
 * One durable run per agent turn. Conversation state lives in Postgres, not the run: the
 * next prompt, and the operator's decision on a gated call, each start a run of their own,
 * so nothing parks between turns and a run's journal is one turn long.
 *
 * Runs in a sandboxed VM: no Node built-ins, no native `fetch`, no `Date.now()`.
 * Side effects live in `../steps/agent-turn.step.ts`; only plain data crosses the boundary.
 * The exported name is the run's identity in the workflow backend; keep it stable.
 */

export const requestSchema = z.object({
  sessionId: z.string(),
  /** Marker writes go here only; also names the run's abort hook. */
  runId: z.string(),
  /** Re-checked against the stored row by the step. */
  userId: z.string(),
  message: agentMessagePayloadSchema,
});

type Request = z.input<typeof requestSchema>;

export const agentSessionWorkflow = async (request: Request) => {
  "use workflow";

  const { sessionId, runId, userId, message } = requestSchema.parse(request);

  /**
   * Closed in `finally` whichever way the turn ends. Without it, a thrown step leaves the
   * `agent.run` row active: invisible to World reads, but counted by anything that trusts the
   * row. The row records the turn's outcome: `failed` for an error or a thrown step,
   * `cancelled` for an abort, which is also what the service writes when it stops the turn.
   */
  let status: Exclude<AgentRunStatus, typeof AgentRunStatus.Active> = "failed";
  try {
    // Cancelling a run only stops rescheduling; a stop reaches the executing step through
    // this signal. The hook is released when the run ends.
    const controller = new AbortController();
    const stop = agentAbortHook.create({ token: agentAbortToken(runId) });
    const turn = runAgentTurnStep(
      { sessionId, runId, userId, message },
      controller.signal
    );
    const outcome = await Promise.race([
      turn,
      stop.then(() => {
        controller.abort();
        return turn;
      }),
    ]);
    status =
      outcome.status === "error"
        ? "failed"
        : outcome.status === "aborted"
          ? "cancelled"
          : "completed";
    return { sessionId, status: outcome.status };
  } finally {
    await completeAgentRunStep(runId, status);
    await closeAgentStreamsStep();
  }
};
