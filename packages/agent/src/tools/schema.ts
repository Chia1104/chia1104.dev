import type {
  AgentHarnessTool,
  AgentToolResult,
} from "@earendil-works/pi-agent-core";
import { StringEnum } from "@earendil-works/pi-ai";
import type { TSchema } from "typebox";
import { Type } from "typebox";
import * as z from "zod";

import { locale } from "@chia/db";

import type { WritingToolContext } from "../types.ts";

/**
 * Schema helpers for tool definitions.
 *
 * pi validates tool arguments with **typebox**, while every domain schema in this repo is
 * **zod**. The division of labour is deliberate:
 *
 * - `parameters` are hand-written typebox. They are the model-facing interface, so their
 *   `description` strings are prompt engineering and want to be written by hand, not
 *   generated.
 * - Anything crossing into a repository or an oRPC procedure is re-parsed with the existing
 *   zod schema inside `execute`, so zod stays the single source of truth for domain rules.
 *
 * {@link zodToTypebox} exists only for shapes too large to restate by hand.
 */

/**
 * Locale enum built with pi-ai's `StringEnum` rather than `Type.Union([Type.Literal(...)])`:
 * some providers (Google) reject `anyOf`/`const` in tool schemas, and `StringEnum` emits the
 * portable `{ type: "string", enum: [...] }` form.
 */
export const LocaleSchema = (description: string) =>
  StringEnum([...locale.enumValues], { description });

/**
 * Escape hatch for large zod shapes.
 *
 * `reused: "inline"` matters — typebox's checker does not resolve `$defs`/`$ref`, which zod
 * emits by default for any schema referenced twice. `io: "input"` picks the pre-transform
 * shape, which is what the model is being asked to produce.
 */
export const zodToTypebox = (schema: z.ZodType): TSchema =>
  z.toJSONSchema(schema, {
    io: "input",
    reused: "inline",
    unrepresentable: "any",
  }) as TSchema;

export { Type };

/**
 * Identity helper that pins the context type while letting TypeScript infer `TParameters` from
 * the literal.
 *
 * Annotating a tool as `AgentHarnessTool<WritingToolContext>` would default `TParameters` to
 * `TSchema`, which makes `Static<TParameters>` resolve to `unknown` and throws away every
 * argument type inside `execute`. Going through this function keeps them.
 */
export const defineTool = <TParameters extends TSchema, TDetails>(
  tool: AgentHarnessTool<WritingToolContext, TParameters, TDetails>
): AgentHarnessTool<WritingToolContext, TParameters, TDetails> => tool;

// ============================================
// Tool result helpers
// ============================================

/** Text-only tool result. `details` is what the UI renders, `content` is what the model reads. */
export const textResult = <TDetails>(
  text: string,
  details: TDetails
): AgentToolResult<TDetails> => ({
  content: [{ type: "text", text }],
  details,
});

/**
 * Renders a value for the model as fenced JSON.
 *
 * Tools return prose + JSON rather than raw JSON so the model gets an explicit framing
 * sentence — it reliably improves how well small results are used.
 */
export const jsonBlock = (value: unknown): string =>
  `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;

/**
 * Truncates long text for the model's context with an explicit marker, so the model knows it
 * is looking at a prefix and can ask for more rather than assuming it saw everything.
 */
export const truncate = (
  text: string,
  maxChars: number
): { text: string; truncated: boolean } => {
  if (text.length <= maxChars) return { text, truncated: false };
  return {
    text: `${text.slice(0, maxChars)}\n\n… [truncated ${text.length - maxChars} more characters]`,
    truncated: true,
  };
};
