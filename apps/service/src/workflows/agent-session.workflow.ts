import * as z from "zod";

import {
  closeAgentStreamsStep,
  completeAgentRunStep,
  runAgentTurnStep,
} from "../steps/agent-turn.step";
import type { AgentTurnOutcome } from "../steps/agent-turn.step";

import {
  AGENT_END_SENTINEL,
  agentApprovalHook,
  agentApprovalToken,
  agentMessageHook,
  agentMessageToken,
} from "./hooks/agent.hooks";

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
  adminId: z.string(),
  userId: z.string(),
  firstMessage: z.object({
    text: z.string(),
    template: z
      .object({ name: z.string(), args: z.array(z.string()).optional() })
      .optional(),
    preAuthorizeToolNames: z.array(z.string()).optional(),
  }),
});

type Request = z.input<typeof requestSchema>;

/** Guard against an unbounded run; a session past this should be forked instead. */
const MAX_TURNS_PER_RUN = 200;

export const agentSessionWorkflow = async (request: Request) => {
  "use workflow";

  const { sessionId, adminId, userId, firstMessage } =
    requestSchema.parse(request);

  const messages = agentMessageHook.create({
    token: agentMessageToken(sessionId),
  });

  let pending: typeof firstMessage | null = firstMessage;
  let turns = 0;

  while (turns < MAX_TURNS_PER_RUN) {
    if (pending === null) {
      // Durable pause: no compute is consumed while waiting for the operator.
      const next = await messages;
      if (next.text === AGENT_END_SENTINEL) break;
      pending = next;
    }

    turns += 1;

    let outcome: AgentTurnOutcome = await runAgentTurnStep({
      sessionId,
      adminId,
      userId,
      text: pending.text,
      template: pending.template,
      preAuthorizeToolNames: pending.preAuthorizeToolNames,
    });
    pending = null;

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

      if (!decision.approved) {
        // Rejected: tell the agent why and let it respond, rather than silently stopping.
        outcome = await runAgentTurnStep({
          sessionId,
          adminId,
          userId,
          text:
            `The operator declined \`${gated.toolName}\`.` +
            (decision.comment ? ` They said: ${decision.comment}` : "") +
            " Do not retry it. Acknowledge and wait for further instructions.",
        });
        break;
      }

      turns += 1;
      outcome = await runAgentTurnStep({
        sessionId,
        adminId,
        userId,
        text:
          `The operator approved \`${gated.toolName}\`.` +
          (decision.comment ? ` They said: ${decision.comment}` : "") +
          " Run it now.",
        // The approval is already persisted, so the gate lets this call through.
        preAuthorizeToolNames: [gated.toolName],
      });
    }
  }

  await completeAgentRunStep(sessionId);
  await closeAgentStreamsStep();

  return { sessionId, turns };
};
