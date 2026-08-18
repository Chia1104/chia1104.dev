import { sleep } from "workflow";
import * as z from "zod";

import { writeAgentAbortStep } from "../steps/agent-abort.step";

import { agentAbortHook, agentAbortToken } from "./hooks/agent.hooks";

/**
 * A durable abort controller for one agent session run.
 *
 * Nothing in the workflow SDK signals a step already executing — cancelling a run only stops it
 * from being scheduled again — so a stop has to reach the turn step through something the step
 * can listen to. This run is that something: it parks on `agentAbortHook`, and when resumed writes
 * one message to its own durable stream. A turn step subscribes to that stream and hands the
 * resulting `AbortSignal` to the harness; the abort request resumes the hook. Both sides only need
 * the session's workflow run id, so it works from any process, and the delivery is the SDK's own
 * stream — no registry, no timer, no second channel.
 *
 * The TTL is a safety net for runs that never close their controller (a failed session run). An
 * expired controller writes `expired: true`, which readers ignore, and the next turn starts a fresh
 * one; it never aborts a turn on its own.
 *
 * Runs in the workflow sandbox: only plain data and durable primitives.
 */

export const agentAbortRequestSchema = z.object({
  workflowRunId: z.string(),
  ttlMs: z.number().int().positive(),
});

type Request = z.input<typeof agentAbortRequestSchema>;

export const agentAbortWorkflow = async (request: Request) => {
  "use workflow";

  const { workflowRunId, ttlMs } = agentAbortRequestSchema.parse(request);

  const hook = agentAbortHook.create({ token: agentAbortToken(workflowRunId) });

  const result = await Promise.race([
    hook.then((payload) => ({ reason: payload.reason, expired: false })),
    sleep(`${ttlMs}ms`).then(() => ({
      reason: "controller expired",
      expired: true,
    })),
  ]);

  await writeAgentAbortStep({ type: "abort", ...result });

  return result;
};
