import * as z from "zod";

/**
 * The public kind's operator configuration — what the dashboard may change about this agent
 * without a deploy. Preferences only: the turn budget and the model allowlist are the cost
 * boundary and stay in code.
 */

/** Room for a persona and a page of house rules; the prompt is cached per session. */
export const PUBLIC_INSTRUCTIONS_MAX_CHARS = 8_000;

export const publicConfigSchema = z.object({
  /** Appended to the system prompt under "Operator instructions"; empty means none. */
  instructions: z.string().max(PUBLIC_INSTRUCTIONS_MAX_CHARS).optional(),
});

export type PublicConfig = z.infer<typeof publicConfigSchema>;

export const PUBLIC_CONFIG_DEFAULTS: PublicConfig = {};
