import * as z from "zod";

/** Schemas both the session and the admin contracts build on. */

export const thinkingLevelSchema = z.enum([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);

/**
 * `(providerId, modelId)` together so a caller cannot send a model id with no provider.
 * Inferring the missing half would silently decide whose account pays. Existence is
 * per-kind policy.
 */
export const agentModelRefSchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
});

export const agentModelInfoSchema = z.object({
  providerId: z.string(),
  modelId: z.string(),
  name: z.string(),
  contextWindow: z.number(),
  supportsReasoning: z.boolean(),
  supportsImageInput: z.boolean(),
  /**
   * True when the provider needs a caller key that is not registered yet. Still listed so
   * the picker can prompt for a key.
   */
  requiresApiKey: z.boolean(),
});
