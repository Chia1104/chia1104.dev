import * as z from "zod";

/** Schemas both the session and the admin contracts build on. */

/** Ordered from no reasoning to the most. */
export const ThinkingLevel = {
  Off: "off",
  Minimal: "minimal",
  Low: "low",
  Medium: "medium",
  High: "high",
  XHigh: "xhigh",
  Max: "max",
} as const;

export type ThinkingLevel = (typeof ThinkingLevel)[keyof typeof ThinkingLevel];

export const thinkingLevelSchema = z.enum(ThinkingLevel);

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
