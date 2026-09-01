import "zod/compile";
import * as z from "zod";

import { formatOperatorDecision } from "@chia/agent-runtime/wire/operator-decision";
import type { OperatorDecision } from "@chia/agent-runtime/wire/operator-decision";
import {
  AGENT_END_SENTINEL,
  agentAbortControllerRefSchema,
  agentApprovalHook,
  agentApprovalToken,
  agentMessageHook,
  agentMessageToken,
  encryptedAgentCredentialsSchema,
} from "@chia/workflow-control/agent-hooks";
import type { EncryptedAgentCredentials } from "@chia/workflow-control/agent-hooks";

import {
  closeAgentStreamsStep,
  completeAgentRunStep,
  runAgentTurnStep,
} from "../steps/agent-turn.step";
import type { AgentTurnOutcome } from "../steps/agent-turn.step";

/**
 * One durable run per agent session. Conversation state lives in Postgres, not the run:
 * the dashboard queries it and pi needs it for branch navigation and compaction.
 *
 * Runs in a sandboxed VM: no Node built-ins, no native `fetch`, no `Date.now()`.
 * Side effects live in `../steps/agent-turn.step.ts`; only plain data crosses the boundary.
 */

export const requestSchema = z.object({
  sessionId: z.string(),
  /** Marker writes go here only. */
  runId: z.string(),
  /** Re-checked against the stored row on every turn. */
  userId: z.string(),
  /** Started by `prompt` before the run; every turn subscribes to it. */
  abortController: agentAbortControllerRefSchema,
  firstMessage: z.object({
    text: z.string(),
    template: z
      .object({ name: z.string(), args: z.array(z.string()).optional() })
      .optional(),
    preAuthorizeToolNames: z.array(z.string()).optional(),
    credentials: encryptedAgentCredentialsSchema.optional(),
  }),
});

type Request = z.input<typeof requestSchema>;

/** A session past this should be forked. */
const MAX_TURNS_PER_RUN = 200;

export const agentSessionWorkflow = async (request: Request) => {
  "use workflow";

  const { sessionId, runId, userId, abortController, firstMessage } =
    requestSchema.parse(request);

  let turns = 0;
  /**
   * Closed in `finally` whichever way the loop ends. Without it, a thrown step leaves the
   * `agent.run` row active: invisible to World reads, but counted by anything that trusts the row.
   */
  let status: "completed" | "failed" = "failed";
  try {
    const messages = agentMessageHook.create({
      token: agentMessageToken(sessionId),
    });
    const conflict = await messages.getConflict();
    if (conflict) {
      throw new Error(
        `Agent session ${sessionId} is already driven by workflow run ${conflict.runId}.`
      );
    }

    turns = await driveSession({
      messages,
      sessionId,
      runId,
      userId,
      abortController,
      firstMessage,
    });
    status = "completed";
  } finally {
    await completeAgentRunStep(runId, abortController, status);
    await closeAgentStreamsStep();
  }

  return { sessionId, turns };
};

const driveSession = async ({
  messages,
  sessionId,
  runId,
  userId,
  abortController,
  firstMessage,
}: {
  messages: ReturnType<typeof agentMessageHook.create>;
  sessionId: string;
  runId: string;
  userId: string;
  abortController: Request["abortController"];
  firstMessage: Request["firstMessage"];
}): Promise<number> => {
  let currentMessage: typeof firstMessage | null = firstMessage;
  let turns = 0;

  /**
   * Credentials from the most recent request. Turns after an approval are synthesised here,
   * so there is no cookie to read. Overwritten wholesale, never merged: an absent payload
   * means the key is gone, and keeping the old ciphertext would let a revoked key last the run.
   */
  let credentials: EncryptedAgentCredentials | undefined =
    firstMessage.credentials;

  while (turns < MAX_TURNS_PER_RUN) {
    if (currentMessage === null) {
      // Durable pause: no compute is consumed while waiting for the operator.
      const next = await messages;
      if (next.text === AGENT_END_SENTINEL) break;
      currentMessage = next;
      credentials = next.credentials;
    }

    turns += 1;

    let outcome: AgentTurnOutcome = await runAgentTurnStep({
      sessionId,
      runId,
      userId,
      abortController,
      text: currentMessage.text,
      template: currentMessage.template,
      preAuthorizeToolNames: currentMessage.preAuthorizeToolNames,
      credentials,
    });
    currentMessage = null;

    /**
     * A step cannot suspend (`createHook` is workflow-only; pi's tools run inside the step).
     * Park until the operator decides, then run one more turn with the approval on record.
     */
    while (outcome.status === "awaiting_approval") {
      const gated = outcome.approvals[0];
      if (!gated) break;

      const decision = await agentApprovalHook.create({
        token: agentApprovalToken(sessionId, gated.toolCallId),
      });
      credentials = decision.credentials;

      const relayed: OperatorDecision = {
        toolCallId: gated.toolCallId,
        toolName: gated.toolName,
        approved: decision.approved,
        comment: decision.comment,
      };

      if (!decision.approved) {
        turns += 1;
        // This turn can gate another tool. Breaking would park the run on the
        // message hook while the persisted approval has no hook to resume.
        outcome = await runAgentTurnStep({
          sessionId,
          runId,
          userId,
          abortController,
          text: formatOperatorDecision(relayed),
          decision: relayed,
          credentials,
        });
        continue;
      }

      turns += 1;
      outcome = await runAgentTurnStep({
        sessionId,
        runId,
        userId,
        abortController,
        text: formatOperatorDecision(relayed),
        decision: relayed,
        // The approval is already persisted, so the gate lets this call through.
        preAuthorizeToolNames: [gated.toolName],
        credentials,
      });
    }
  }

  return turns;
};
