import * as z from "zod";

/**
 * Operator preferences the dashboard may change without a deploy. Tool tiers, approval, turn
 * budget and the model allowlist stay in code.
 */

/** Long enough for a page of house rules; the prompt is cached per session, so size is cheap. */
export const WRITING_INSTRUCTIONS_MAX_CHARS = 8_000;

export const writingConfigSchema = z.object({
  /** Appended to the system prompt under "Operator instructions"; empty means none. */
  instructions: z.string().max(WRITING_INSTRUCTIONS_MAX_CHARS).optional(),
});

export type WritingConfig = z.infer<typeof writingConfigSchema>;

export const WRITING_CONFIG_DEFAULTS: WritingConfig = {};
