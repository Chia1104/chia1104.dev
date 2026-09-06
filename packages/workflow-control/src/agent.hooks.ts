import { defineHook } from "workflow";
import * as z from "zod";

import type { KeyId } from "@chia/ai/provider";

/**
 * The payload one agent turn run starts with, and the abort hook a run parks on.
 *
 * `defineHook` shares the payload type between the workflow that awaits and
 * the API route that resumes, and validates the schema at the boundary.
 * Tokens are deterministic so a request that only holds the controller id can
 * reconstruct them without a lookup. `resumeHook` is server-side only and the
 * route sits behind `adminGuard`.
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

/** What the operator handed the turn beside the text; the kind renders and validates it. */
export const agentAttachmentPayloadSchema = z.object({
  type: z.string().min(1),
  id: z.number().int(),
});

/** The operator's decision on a gated call, relayed to the model as this turn's message. */
export const agentOperatorDecisionSchema = z.object({
  toolCallId: z.string(),
  toolName: z.string(),
  approved: z.boolean(),
  comment: z.string().optional(),
});

/** One turn's input: an operator prompt, or the decision the turn relays. */
export const agentMessagePayloadSchema = z.object({
  text: z.string(),
  template: z
    .object({ name: z.string(), args: z.array(z.string()).optional() })
    .optional(),
  attachments: z.array(agentAttachmentPayloadSchema).optional(),
  decision: agentOperatorDecisionSchema.optional(),
  credentials: encryptedAgentCredentialsSchema.optional(),
});

/**
 * Aborts the turn a run is executing. Keyed by the controller's own id,
 * minted by the service when it starts the run.
 */
export const agentAbortPayloadSchema = z.object({ reason: z.string() });

export const agentAbortHook = defineHook({ schema: agentAbortPayloadSchema });

/**
 * Hook token id and the controller run whose stream turns subscribe to.
 * Carried in the run's request and `agent.run.metadata`. Lives here
 * because both the API process and the workflow sandbox import it.
 */
export const agentAbortControllerRefSchema = z.object({
  id: z.string(),
  runId: z.string(),
});

export type AgentAbortControllerRef = z.infer<
  typeof agentAbortControllerRefSchema
>;

export const agentAbortToken = (controllerId: string): string =>
  `agent:abort:${controllerId}`;
