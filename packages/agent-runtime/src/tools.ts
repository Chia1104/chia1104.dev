import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import { StringEnum } from "@earendil-works/pi-ai";
import { IsArray, IsObject, Type } from "typebox";
import type { TNull, TOptional, TSchema, TUnion } from "typebox";
import * as z from "zod";

import { locale } from "@chia/db/schema/enums";
import { asJsonArray, asJsonObject, asJsonValue } from "@chia/utils/json";
import type { JsonObject, JsonValue } from "@chia/utils/json";

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

/**
 * Marks a schema {@link optional} built; `defineTool` drops a `null` argument for it. A `~`
 * key, non-enumerable like TypeBox's own, survives the deep clone `Type.Optional` makes of
 * whatever it wraps and never reaches the provider.
 */
const OMITS_NULL = "~omitsNull";

interface OmitsNullSchema extends TUnion<[TSchema, TNull]> {
  [OMITS_NULL]: true;
}

const omitsNull = (schema: TSchema): schema is OmitsNullSchema =>
  OMITS_NULL in schema && schema[OMITS_NULL] === true;

const schemaOptions = z
  .object({ description: z.string().optional(), default: z.json().optional() })
  .loose();

/**
 * An optional parameter the model may also pass as `null`. `Type.Optional` alone offers no
 * way to leave a field out, and a model that fills every field then invents a value (a
 * lesson id, a heading of `##`); one that offers `null` gets `null`, which `defineTool`
 * drops before `execute`. A field where `null` means something, such as clearing it, writes
 * its union by hand instead.
 */
export const optional = <T extends TSchema>(schema: T): TOptional<T> => {
  const { description, default: fallback } = schemaOptions.parse(schema);
  const nullable = Type.Optional(
    Type.Union([schema, Type.Null()], {
      ...(description !== undefined && { description }),
      ...(fallback !== undefined && { default: fallback }),
    })
  );
  Object.defineProperty(nullable, OMITS_NULL, { value: true });
  // SAFETY: `defineTool` removes a `null` before `execute`, so the static type never carries
  // one; the union's own static type is what the cast discards.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions
  return nullable as unknown as TOptional<T>;
};

/** The arguments without any `null` an {@link optional} parameter received, at any depth. */
const omitNulls = (schema: TSchema, value: JsonValue): JsonValue => {
  if (IsArray(schema)) {
    const items = asJsonArray(value);
    return items ? items.map((item) => omitNulls(schema.items, item)) : value;
  }
  if (!IsObject(schema)) return value;
  const record = asJsonObject(value);
  if (!record) return value;
  const cleaned: JsonObject = {};
  for (const [key, entry] of Object.entries(record)) {
    const property = schema.properties[key];
    if (!property) {
      cleaned[key] = entry;
    } else if (entry === null) {
      if (!omitsNull(property)) cleaned[key] = null;
    } else {
      cleaned[key] = omitNulls(
        omitsNull(property) ? property.anyOf[0] : property,
        entry
      );
    }
  }
  return cleaned;
};

/** A tool's model-facing half: what Pi sends the provider, readable without a turn's ports. */
export type ToolSpec<TParameters extends TSchema = TSchema> = Omit<
  AgentTool<TParameters>,
  "execute"
>;

/**
 * A tool declared once: called with a turn's ports it yields the `AgentTool` Pi runs, and its
 * `spec` is readable without a turn, so the capabilities a kind advertises and the tools it
 * binds come from the same list.
 */
export interface ToolFactory<TContext> {
  (context: TContext): AgentTool;
  readonly spec: ToolSpec;
}

/** Pairs a spec with an `execute` closed over one turn's ports; erased to `AgentTool` so a kind's tools share one array. */
export const defineTool = <TContext, TParameters extends TSchema>(
  spec: ToolSpec<TParameters>,
  execute: (context: TContext) => AgentTool<TParameters, unknown>["execute"]
): ToolFactory<TContext> =>
  Object.assign(
    (context: TContext): AgentTool => {
      // SAFETY: Pi validates arguments against `spec.parameters` before it calls `execute`;
      // a `null` on an `optional` parameter passes that check and is dropped here.
      const run = execute(context) as AgentTool["execute"];
      return {
        ...spec,
        execute: (toolCallId, params, signal, onUpdate) => {
          const json = asJsonValue(params);
          return run(
            toolCallId,
            json === undefined ? params : omitNulls(spec.parameters, json),
            signal,
            onUpdate
          );
        },
      };
    },
    { spec }
  );

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
