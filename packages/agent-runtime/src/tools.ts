import type {
  AgentTool as PiAgentTool,
  AgentToolResult,
} from "@earendil-works/pi-agent-core";
import { StringEnum } from "@earendil-works/pi-ai";
import type { TSchema } from "typebox";
import { Type } from "typebox";
import * as z from "zod";

import { locale } from "@chia/db/schema/enums";

import type { AgentTool } from "./types.ts";

/**
 * pi validates tool arguments with typebox, while domain schemas are zod.
 * `parameters` are hand-written typebox (model-facing descriptions).
 * Anything crossing a repository is re-parsed with zod inside `execute`.
 */

export { Type };

/**
 * Locale enum via pi-ai `StringEnum`, not `Type.Union([Type.Literal(...)])`.
 * Google rejects `anyOf`/`const` in tool schemas; `StringEnum` emits
 * `{ type: "string", enum: [...] }`.
 */
export const LocaleSchema = (description: string) =>
  StringEnum([...locale.enumValues], { description });

/**
 * Escape hatch for large zod shapes.
 * `reused: "inline"`: typebox's checker does not resolve `$defs`/`$ref`, which zod emits for
 * any schema referenced twice.
 * `io: "input"` picks the pre-transform shape the model is asked to produce.
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
 * Annotating a tool as `AgentTool<TContext>` defaults `TParameters` to `TSchema`, so
 * `Static<TParameters>` becomes `unknown` inside `execute`.
 * Curried because TypeScript cannot pin `TContext` while still inferring `TParameters` from the
 * literal.
 */
export const toolDefiner =
  <TContext extends object>() =>
  <TParameters extends TSchema, TDetails>(
    tool: AgentTool<TContext, TParameters, TDetails>
  ): AgentTool<TContext, TParameters, TDetails> =>
    tool;

/** A context value, or a provider resolved once per turn. */
export type ToolContextSource<TContext extends object> =
  | TContext
  | (() => TContext | Promise<TContext>);

export const resolveToolContext = async <TContext extends object>(
  source: ToolContextSource<TContext>
): Promise<TContext> =>
  source instanceof Function
    ? await /* SAFETY: A function-typed source is the provider form; contexts themselves are plain objects. */ (
        source as () => TContext | Promise<TContext>
      )()
    : source;

/** Closes each tool over the turn's context into the four-argument shape Pi executes. */
export const bindToolContext = <TContext extends object>(
  tools: readonly AgentTool<TContext>[],
  context: TContext
): PiAgentTool[] =>
  tools.map((tool) => ({
    ...tool,
    execute: (toolCallId, params, signal, onUpdate) =>
      tool.execute(toolCallId, params, signal, onUpdate, context),
  }));

/** Text-only tool result. `details` is what the UI renders, `content` is what the model reads. */
export const textResult = <TDetails>(
  text: string,
  details: TDetails
): AgentToolResult<TDetails> => ({
  content: [{ type: "text", text }],
  details,
});

/** Fenced JSON for the model. Tools return prose + JSON so the model gets an explicit framing sentence. */
export const jsonBlock = <TValue>(value: TValue): string =>
  `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;

/** Truncates with an explicit marker so the model knows it saw a prefix and can ask for more. */
export const truncate = (text: string, maxChars: number) => {
  if (text.length <= maxChars) return { text, truncated: false } as const;
  return {
    text: `${text.slice(0, maxChars)}\n\n… [truncated ${text.length - maxChars} more characters]`,
    truncated: true,
  } as const;
};

/** Tool results are parsed before a transcript summarizer reads their structured fields. */
const jsonRecordSchema = z.record(z.string(), z.json());
const textContentSchema = z.object({ text: z.string().optional() }).loose();
const summarizedToolResultSchema = z
  .object({
    content: z.array(textContentSchema).optional(),
    details: jsonRecordSchema.optional(),
  })
  .loose();

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
