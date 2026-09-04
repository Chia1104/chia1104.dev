import { defineHook } from "workflow";
import * as z from "zod";

import type { KeyId } from "@chia/ai/provider";

/**
 * Durable inboxes and pause points for an agent session.
 *
 * `defineHook` shares the payload type between the workflow that awaits and
 * the API route that resumes, and validates the schema at the boundary.
 *
 * Tokens are deterministic so a request that only holds a session id (and,
 * for approvals, a tool call id) can reconstruct them without a lookup.
 * `resumeHook` is server-side only and both routes sit behind `adminGuard`.
 *
 * Imported from the workflow sandbox, so this module must stay free of Node
 * built-ins.
 */

/**
 * Caller-supplied keys, still encrypted, one per `KeyId`.
 *
 * RSA ciphertext from `encodeApiKey`; decrypted only inside the turn step
 * with `AI_AUTH_PRIVATE_KEY`. The workflow backend journals everything that
 * crosses this boundary, so plaintext here would be a secret at rest.
 * Absent means the turn runs on the house gateway account.
 */
export const encryptedAgentCredentialsSchema = z.object({
  openai: z.string().optional(),
  anthropic: z.string().optional(),
  gateway: z.string().optional(),
}) satisfies z.ZodType<Partial<Record<KeyId, string>>>;

export type EncryptedAgentCredentials = z.infer<
  typeof encryptedAgentCredentialsSchema
>;

export const agentMessagePayloadSchema = z.object({
  /** `"/end"` closes the session's run. */
  text: z.string(),
  template: z
    .object({ name: z.string(), args: z.array(z.string()).optional() })
    .optional(),
  /** Pre-authorised for this turn only. */
  preAuthorizeToolNames: z.array(z.string()).optional(),
  credentials: encryptedAgentCredentialsSchema.optional(),
});

export const agentMessageHook = defineHook({
  schema: agentMessagePayloadSchema,
});

export const agentApprovalPayloadSchema = z.object({
  approved: z.boolean(),
  comment: z.string().optional(),
  /**
   * Refreshed here because later turns are synthesised by the workflow and
   * have no request to read a cookie from. An approval can land days later,
   * after the operator has rotated their key.
   */
  credentials: encryptedAgentCredentialsSchema.optional(),
});

export const agentApprovalHook = defineHook({
  schema: agentApprovalPayloadSchema,
});

/**
 * Aborts the turn a session's run is executing. Keyed by the controller's
 * own id, minted by `prompt` when it starts the session run.
 */
export const agentAbortPayloadSchema = z.object({ reason: z.string() });

export const agentAbortHook = defineHook({ schema: agentAbortPayloadSchema });

/**
 * Hook token id and the controller run whose stream turns subscribe to.
 * Carried in the session run's request and `agent.run.metadata`. Lives here
 * because both the API process and the workflow sandbox import it.
 */
export const agentAbortControllerRefSchema = z.object({
  id: z.string(),
  runId: z.string(),
});

export type AgentAbortControllerRef = z.infer<
  typeof agentAbortControllerRefSchema
>;

/** Ends the session's workflow run rather than starting another turn. */
export const AGENT_END_SENTINEL = "/end";

export const agentMessageToken = (sessionId: string): string =>
  `agent:msg:${sessionId}`;

export const agentApprovalToken = (
  sessionId: string,
  toolCallId: string
): string => `agent:approve:${sessionId}:${toolCallId}`;

export const agentAbortToken = (controllerId: string): string =>
  `agent:abort:${controllerId}`;
