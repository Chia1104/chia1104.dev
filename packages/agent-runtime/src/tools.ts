import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import { StringEnum } from "@earendil-works/pi-ai";
import type { TSchema } from "typebox";
import * as z from "zod";

import { locale } from "@chia/db/schema/enums";

/**
 * pi validates tool arguments with typebox, while domain schemas are zod.
 * `parameters` are hand-written typebox (model-facing descriptions).
 * Anything crossing a repository is re-parsed with zod inside `execute`.
 */

/**
 * Locale enum via pi-ai `StringEnum`, not `Type.Union([Type.Literal(...)])`.
 * Google rejects `anyOf`/`const` in tool schemas; `StringEnum` emits
 * `{ type: "string", enum: [...] }`.
 */
export const LocaleSchema = (description: string) =>
  StringEnum([...locale.enumValues], { description });

/** A tool's model-facing half: what Pi sends the provider, readable without a turn's ports. */
export type ToolSpec<TParameters extends TSchema = TSchema> = Omit<
  AgentTool<TParameters>,
  "execute"
>;

/**
 * Pairs a spec with an `execute` closed over one turn's ports.
 * Erased to `AgentTool` so a kind's tools share one array.
 */
export const bindTool = <TParameters extends TSchema>(
  spec: ToolSpec<TParameters>,
  execute: AgentTool<TParameters, unknown>["execute"]
): AgentTool => ({
  ...spec,
  // SAFETY: Pi validates arguments against `spec.parameters` before it calls `execute`.
  execute: execute as AgentTool["execute"],
});

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
