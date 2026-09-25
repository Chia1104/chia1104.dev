import * as z from "zod";

import { agentAttachmentInputSchema } from "@chia/agent-runtime/wire/schema";
import type { KeyId } from "@chia/ai/provider";

/**
 * The payloads that cross the service/workflow boundary for an agent turn. Zod only: the
 * oRPC contracts reach this module, and through them the browser, so nothing here may
 * import the workflow SDK. The hook itself lives in `agent.hooks.ts`.
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
  attachments: z.array(agentAttachmentInputSchema).optional(),
  decision: agentOperatorDecisionSchema.optional(),
  credentials: encryptedAgentCredentialsSchema.optional(),
});

export type AgentMessagePayload = z.infer<typeof agentMessagePayloadSchema>;

/**
 * Aborts the turn a run is executing. Keyed by the controller's own id,
 * minted by the service when it starts the run.
 */
export const agentAbortPayloadSchema = z.object({ reason: z.string() });

/**
 * Hook token id and the controller run whose stream turns subscribe to.
 * Carried in the run's request and `agent.run.metadata`.
 */
export const agentAbortControllerRefSchema = z.object({
  id: z.string(),
  runId: z.string(),
});

export type AgentAbortControllerRef = z.infer<
  typeof agentAbortControllerRefSchema
>;
