import * as z from "zod";

import {
  closeAgentStreamsStep,
  completeAgentRunStep,
  runAgentTurnStep,
} from "../steps/agent-turn.step";
import type { AgentTurnOutcome } from "../steps/agent-turn.step";

import {
  AGENT_END_SENTINEL,
  agentAbortControllerRefSchema,
  agentApprovalHook,
  agentApprovalToken,
  agentMessageHook,
  agentMessageToken,
  encryptedAgentCredentialsSchema,
} from "./hooks/agent.hooks";
import type { EncryptedAgentCredentials } from "./hooks/agent.hooks";

/**
 * One durable run per agent session.
 *
 * Shape: **multi-turn**, but the conversation state lives in Postgres rather than in the run. The
 * run is a durable *driver* — it waits for the next message, executes a turn, and parks on an
 * approval hook when a tier-3 tool is gated. The transcript stays in `agent_session_entry` because
 * the dashboard queries it directly and pi needs it for branch navigation and compaction; a
 * workflow event log is an execution journal, not a queryable domain store.
 *
 * What the run buys, that an in-process registry could not:
 * - the turn survives a deploy or restart mid-flight
 * - an approval can be granted a day later, and the run wakes with no compute burned meanwhile
 * - stream replay is durable, so a reconnecting client sees the whole turn
 *
 * This function runs in a **sandboxed VM**: no Node built-ins, no native `fetch`, no `Date.now()`.
 * Everything real happens in `../steps/agent-turn.step.ts`; only plain data crosses the boundary.
 */

export const requestSchema = z.object({
  sessionId: z.string(),
  /** Session owner; every turn step re-checks it against the stored row. */
  userId: z.string(),
  /** This run's abort controller, started by `prompt` before the run; every turn subscribes to it. */
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

/** Guard against an unbounded run; a session past this should be forked instead. */
const MAX_TURNS_PER_RUN = 200;

export const agentSessionWorkflow = async (request: Request) => {
  "use workflow";

  const { sessionId, userId, abortController, firstMessage } =
    requestSchema.parse(request);

  const messages = agentMessageHook.create({
    token: agentMessageToken(sessionId),
  });
  const conflict = await messages.getConflict();
  if (conflict) {
    throw new Error(
      `Agent session ${sessionId} is already driven by workflow run ${conflict.runId}.`
    );
  }

  let currentMessage: typeof firstMessage | null = firstMessage;
  let turns = 0;

  /**
   * The credentials the *most recent* request carried.
   *
   * The run outlives the request that started it, and the turns that follow an approval are
   * synthesised below rather than sent by anyone — so there is no cookie to read at the moment they
   * execute. Holding the last received ciphertext here is what lets those turns reach the
   * operator's own provider account.
   *
   * Overwritten wholesale, never merged: an absent payload means the operator no longer has that
   * key registered, and treating it as "keep whatever we had" would let a revoked key keep working
   * for the life of the run. Each prompt and each approval restates the full set.
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
      userId,
      abortController,
      text: currentMessage.text,
      template: currentMessage.template,
      preAuthorizeToolNames: currentMessage.preAuthorizeToolNames,
      credentials,
    });
    currentMessage = null;

    /**
     * Approval loop.
     *
     * A gated tool call was refused by the permission gate, so the turn ended cleanly with the
     * refusal in the transcript. Park here until the operator decides, then run one more turn that
     * re-issues the call with the approval on record.
     *
     * The refusal-then-resume dance exists because a step cannot suspend: workflow primitives like
     * `createHook` are only available at the workflow level, and pi's tools execute inside the step.
     */
    while (outcome.status === "awaiting_approval") {
      const gated = outcome.approvals[0];
      if (!gated) break;

      const decision = await agentApprovalHook.create({
        token: agentApprovalToken(sessionId, gated.toolCallId),
      });
      credentials = decision.credentials;

      if (!decision.approved) {
        turns += 1;
        // Rejected: tell the agent why and let it respond, rather than silently stopping.
        // Loops back rather than breaking: this turn can itself gate another tool, and
        // breaking would discard that `awaiting_approval` outcome — the run would park on
        // the message hook while the persisted approval has no hook to resume.
        outcome = await runAgentTurnStep({
          sessionId,
          userId,
          abortController,
          text:
            `The operator declined \`${gated.toolName}\`.` +
            (decision.comment ? ` They said: ${decision.comment}` : "") +
            " Do not retry it. Acknowledge and wait for further instructions.",
          credentials,
        });
        continue;
      }

      turns += 1;
      outcome = await runAgentTurnStep({
        sessionId,
        userId,
        abortController,
        text:
          `The operator approved \`${gated.toolName}\`.` +
          (decision.comment ? ` They said: ${decision.comment}` : "") +
          " Run it now.",
        // The approval is already persisted, so the gate lets this call through.
        preAuthorizeToolNames: [gated.toolName],
        credentials,
      });
    }
  }

  await completeAgentRunStep(sessionId, abortController);
  await closeAgentStreamsStep();

  return { sessionId, turns };
};
