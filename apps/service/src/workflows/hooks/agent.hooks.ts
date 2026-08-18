import { defineHook } from "workflow";
import * as z from "zod";

/**
 * Durable inboxes and pause points for an agent session.
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

/**
 * Caller-supplied provider keys, **still encrypted**.
 *
 * Every value here is the RSA ciphertext produced by `encodeApiKey` and stored in the operator's
 * cookie; it is decrypted only inside the turn step, with `AI_AUTH_PRIVATE_KEY`. Keeping the
 * ciphertext as the transport form matters because everything crossing this boundary is journaled
 * durably by the workflow backend — plaintext here would be a plaintext secret at rest.
 *
 * Absent means "no bring-your-own key": the turn runs on the house gateway account.
 */
export const encryptedAgentCredentialsSchema = z.object({
  openai: z.string().optional(),
  anthropic: z.string().optional(),
});

export type EncryptedAgentCredentials = z.infer<
  typeof encryptedAgentCredentialsSchema
>;

export const agentMessageHook = defineHook({
  schema: z.object({
    /** `"/end"` closes the session's run. */
    text: z.string(),
    template: z
      .object({ name: z.string(), args: z.array(z.string()).optional() })
      .optional(),
    /** Tool names pre-authorised for this turn only. */
    preAuthorizeToolNames: z.array(z.string()).optional(),
    credentials: encryptedAgentCredentialsSchema.optional(),
  }),
});

export const agentApprovalHook = defineHook({
  schema: z.object({
    approved: z.boolean(),
    comment: z.string().optional(),
    /**
     * Refreshed on the approval too, because the turns that follow an approval are synthesised by
     * the workflow itself and have no request of their own to read a cookie from. An approval can
     * land days after the prompt that triggered it, by which point the operator may well have
     * rotated their key.
     */
    credentials: encryptedAgentCredentialsSchema.optional(),
  }),
});

/**
 * Resumed to abort the turn a session's run is executing — see `agent-abort.workflow.ts`. Keyed by
 * the session's workflow run id: one controller per run, reconnected by every turn.
 */
export const agentAbortHook = defineHook({
  schema: z.object({ reason: z.string() }),
});

/** Sentinel that ends the session's workflow run rather than starting another turn. */
export const AGENT_END_SENTINEL = "/end";

export const agentMessageToken = (sessionId: string): string =>
  `agent:msg:${sessionId}`;

export const agentApprovalToken = (
  sessionId: string,
  toolCallId: string
): string => `agent:approve:${sessionId}:${toolCallId}`;

export const agentAbortToken = (workflowRunId: string): string =>
  `agent:abort:${workflowRunId}`;
