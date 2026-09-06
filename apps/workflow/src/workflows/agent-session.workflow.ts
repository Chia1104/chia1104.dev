import "zod/compile";
import * as z from "zod";

import {
  agentAbortControllerRefSchema,
  agentMessagePayloadSchema,
} from "@chia/workflow-control/agent-hooks";

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
  /** Marker writes go here only. */
  runId: z.string(),
  /** Re-checked against the stored row by the step. */
  userId: z.string(),
  /** Started by the service before the run; the step subscribes to it. */
  abortController: agentAbortControllerRefSchema,
  message: agentMessagePayloadSchema,
});

type Request = z.input<typeof requestSchema>;

export const agentSessionWorkflow = async (request: Request) => {
  "use workflow";

  const { sessionId, runId, userId, abortController, message } =
    requestSchema.parse(request);

  /**
   * Closed in `finally` whichever way the turn ends. Without it, a thrown step leaves the
   * `agent.run` row active: invisible to World reads, but counted by anything that trusts the
   * row. The row records the turn's outcome: `failed` for an error or a thrown step,
   * `cancelled` for an abort, which is also what the service writes when it stops the turn.
   */
  let status: "completed" | "failed" | "cancelled" = "failed";
  try {
    const outcome = await runAgentTurnStep({
      sessionId,
      runId,
      userId,
      abortController,
      text: message.text,
      template: message.template,
      attachments: message.attachments,
      decision: message.decision,
      credentials: message.credentials,
    });
    status =
      outcome.status === "error"
        ? "failed"
        : outcome.status === "aborted"
          ? "cancelled"
          : "completed";
    return { sessionId, status: outcome.status };
  } finally {
    await completeAgentRunStep(runId, abortController, status);
    await closeAgentStreamsStep();
  }
};
