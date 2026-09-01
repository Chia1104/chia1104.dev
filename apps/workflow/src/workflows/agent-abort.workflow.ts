import "zod/compile";
import { sleep } from "workflow";
import * as z from "zod";

import {
  agentAbortHook,
  agentAbortToken,
} from "@chia/workflow-control/agent-hooks";

import { writeAgentAbortStep } from "../steps/agent-abort.step";

/**
 * Durable abort controller for one session run. Cancelling a run only stops rescheduling;
 * a stop has to reach the executing step through this run's stream.
 *
 * Parks on `agentAbortHook`; on resume writes one message. The turn step subscribes and
 * hands the `AbortSignal` to the harness. Started by `prompt` before the session run;
 * `{ id, runId }` travel in the session request so there is one controller, no lookup race.
 *
 * TTL is a safety net for runs that never close their controller. Expired writes
 * `expired: true`, which readers ignore; it never aborts a turn.
 *
 * Runs in the workflow sandbox: no Node built-ins.
 */

export const agentAbortRequestSchema = z.object({
  id: z.string(),
  ttlMs: z.number().int().positive(),
});

type Request = z.input<typeof agentAbortRequestSchema>;

export const agentAbortWorkflow = async (request: Request) => {
  "use workflow";

  const { id, ttlMs } = agentAbortRequestSchema.parse(request);

  const hook = agentAbortHook.create({ token: agentAbortToken(id) });

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
