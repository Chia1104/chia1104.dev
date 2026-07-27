import { defineHook } from "workflow";
import * as z from "zod";

/**
 * Durable pause points for an agent session.
 *
 * `defineHook` is preferred over raw `createHook`/`resumeHook` because the payload type is shared
 * between the workflow that awaits and the API route that resumes, and the schema validates at
 * the boundary.
 *
 * Tokens are **deterministic** so a request that only holds a session id (and, for approvals, a
 * tool call id) can reconstruct them without a lookup. That is exactly the use case the SDK
 * documents deterministic tokens for; they are safe here because `resumeHook` is server-side only
 * and both routes sit behind `adminGuard`.
 *
 * This module is imported from inside the workflow sandbox, so it must stay free of Node built-ins
 * — `defineHook` and zod are both pure.
 */

export const agentMessageHook = defineHook({
  schema: z.object({
    /** `"/end"` closes the session's run. */
    text: z.string(),
    template: z
      .object({ name: z.string(), args: z.array(z.string()).optional() })
      .optional(),
    /** Tool names pre-authorised for this turn only. */
    preAuthorizeToolNames: z.array(z.string()).optional(),
  }),
});

export const agentApprovalHook = defineHook({
  schema: z.object({
    approved: z.boolean(),
    comment: z.string().optional(),
  }),
});

/** Sentinel that ends the session's workflow run rather than starting another turn. */
export const AGENT_END_SENTINEL = "/end";

export const agentMessageToken = (sessionId: string): string =>
  `agent:msg:${sessionId}`;

export const agentApprovalToken = (
  sessionId: string,
  toolCallId: string
): string => `agent:approve:${sessionId}:${toolCallId}`;
