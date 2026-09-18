import * as z from "zod";

/**
 * Operator preferences the dashboard may change without a deploy. The turn budget and the
 * model allowlist are the cost boundary and stay in code.
 */

/** Room for a persona and a page of house rules; the prompt is cached per session. */
export const PUBLIC_INSTRUCTIONS_MAX_CHARS = 8_000;

export const publicConfigSchema = z.object({
  /** Appended to the system prompt under "Operator instructions"; empty means none. */
  instructions: z.string().max(PUBLIC_INSTRUCTIONS_MAX_CHARS).optional(),
  /** Guests never get it, and it stays off without a guard provider: fetched pages are checked before the model reads them. */
  webAccess: z
    .boolean()
    .optional()
    .describe(
      "Let signed-in visitors' turns search and read the web. Needs GUARD_PROVIDER on the workflow service; guests never get it."
    ),
});

export type PublicConfig = z.infer<typeof publicConfigSchema>;

export const PUBLIC_CONFIG_DEFAULTS: PublicConfig = {};
