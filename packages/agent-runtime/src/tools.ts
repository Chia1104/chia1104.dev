import type {
  AgentHarnessTool,
  AgentToolResult,
} from "@earendil-works/pi-agent-core";
import { StringEnum } from "@earendil-works/pi-ai";
import type { TSchema } from "typebox";
import { Type } from "typebox";
import * as z from "zod";

import { locale } from "@chia/db";

/**
 * Kind-agnostic helpers for authoring Pi tools.
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

export { Type };

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
  // SAFETY: Zod's JSON Schema output is consumed only by TypeBox-compatible tool validators.
  z.toJSONSchema(schema, {
    io: "input",
    reused: "inline",
    unrepresentable: "any",
  }) as TSchema;

/**
 * Builds a `defineTool` for one context type.
 *
 * Annotating a tool as `AgentHarnessTool<TContext>` would default `TParameters` to `TSchema`,
 * which makes `Static<TParameters>` resolve to `unknown` and throws away every argument type
 * inside `execute`. Curried because TypeScript cannot pin `TContext` explicitly while still
 * inferring `TParameters` from the literal; each kind calls this once and exports the result.
 */
export const toolDefiner =
  <TContext extends object>() =>
  <TParameters extends TSchema, TDetails>(
    tool: AgentHarnessTool<TContext, TParameters, TDetails>
  ): AgentHarnessTool<TContext, TParameters, TDetails> =>
    tool;

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
export const jsonBlock = <TValue>(value: TValue): string =>
  `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;

/**
 * Truncates long text for the model's context with an explicit marker, so the model knows it
 * is looking at a prefix and can ask for more rather than assuming it saw everything.
 */
export const truncate = (text: string, maxChars: number) => {
  if (text.length <= maxChars) return { text, truncated: false } as const;
  return {
    text: `${text.slice(0, maxChars)}\n\n… [truncated ${text.length - maxChars} more characters]`,
    truncated: true,
  } as const;
};

// ============================================
// Tool result narrowing (for transcript summaries)
// ============================================

/** Tool results are parsed before a transcript summarizer reads their structured fields. */
const jsonRecordSchema = z.record(z.string(), z.json());
const jsonArraySchema = z.array(z.json());
const textContentSchema = z.object({ text: z.string().optional() }).loose();
const summarizedToolResultSchema = z
  .object({
    content: z.array(textContentSchema).optional(),
    details: jsonRecordSchema.optional(),
  })
  .loose();

export const asRecord = <TValue>(value: TValue) =>
  jsonRecordSchema.safeParse(value).data;

export const asArray = <TValue>(value: TValue) =>
  jsonArraySchema.safeParse(value).data;

export const asString = <TValue>(value: TValue) =>
  z.string().safeParse(value).data;

export const asNumber = <TValue>(value: TValue) =>
  z.number().safeParse(value).data;

/** The `details` a tool returned, from either the live or the persisted result shape. */
export const toolResultDetails = <TResult>(result: TResult) =>
  summarizedToolResultSchema.safeParse(result).data?.details;

/** First line of an error result's text, capped so the transcript stays one line. */
export const toolErrorText = <TResult>(result: TResult): string | undefined => {
  const parsed = summarizedToolResultSchema.safeParse(result).data;
  const text = parsed?.content?.[0]?.text;
  if (!text) return undefined;
  const [firstLine] = text.split("\n");
  return firstLine && firstLine.length > 160
    ? `${firstLine.slice(0, 160)}…`
    : firstLine;
};
