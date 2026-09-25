import * as z from "zod";

import { ApprovalVerdict } from "@chia/agent-runtime/types";
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

/** The answers to the gated calls a turn stopped on, which the next turn resumes. */
export const agentTurnResumeSchema = z.object({
  interruptedRunId: z.string(),
  decisions: z
    .array(
      z.object({
        toolCallId: z.string(),
        verdict: z.enum(ApprovalVerdict),
        comment: z.string().optional(),
      })
    )
    .min(1),
});

/** One turn's input: an operator prompt, or the answers that resume a stopped turn. */
export const agentMessagePayloadSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("prompt"),
    text: z.string(),
    template: z
      .object({ name: z.string(), args: z.array(z.string()).optional() })
      .optional(),
    attachments: z.array(agentAttachmentInputSchema).optional(),
    credentials: encryptedAgentCredentialsSchema.optional(),
  }),
  z.object({
    type: z.literal("resume"),
    resume: agentTurnResumeSchema,
    credentials: encryptedAgentCredentialsSchema.optional(),
  }),
]);

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
