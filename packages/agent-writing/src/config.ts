import * as z from "zod";

/**
 * The writing kind's operator configuration — what the dashboard may change about this agent
 * without a deploy. Only preferences belong here. Tool tiers, the approval policy, the turn
 * budget and the model allowlist are safety boundaries and stay in code.
 */

/** Long enough for a page of house rules; the prompt is cached per session, so size is cheap. */
export const WRITING_INSTRUCTIONS_MAX_CHARS = 8_000;

export const writingConfigSchema = z.object({
  /** Appended to the system prompt under "Operator instructions"; empty means none. */
  instructions: z.string().max(WRITING_INSTRUCTIONS_MAX_CHARS).optional(),
});

export type WritingConfig = z.infer<typeof writingConfigSchema>;

export const WRITING_CONFIG_DEFAULTS: WritingConfig = {};
