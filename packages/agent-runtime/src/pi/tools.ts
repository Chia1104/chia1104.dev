import type { AgentTool as PiAgentTool } from "@earendil-works/pi-agent-core";
import * as z from "zod";

import { logger } from "@chia/observability/logger";
import {
  asJsonArray,
  asJsonObject,
  asJsonValue,
  asString,
} from "@chia/utils/json";
import type { JsonObject, JsonValue } from "@chia/utils/json";

import { traceToolCall } from "../telemetry.ts";
import type { AgentTool } from "../tools.ts";
import type { AgentPolicy } from "../types.ts";

const acceptsNull = (schema: JsonObject): boolean => {
  const { type } = schema;
  if (type === "null") return true;
  if (Array.isArray(type) && type.includes("null")) return true;
  const branches = asJsonArray(schema.anyOf) ?? asJsonArray(schema.oneOf);
  return (
    branches?.some((branch) => {
      const object = asJsonObject(branch);
      return object !== undefined && acceptsNull(object);
    }) ?? false
  );
};

const requiredOf = (schema: JsonObject): ReadonlySet<string> =>
  new Set(asJsonArray(schema.required)?.flatMap((key) => asString(key) ?? []));

/** Every optional property that rejects `null` is offered as nullable, at any depth. */
const offerNull = (schema: JsonObject): JsonObject => {
  const next = { ...schema };
  const items = asJsonObject(schema.items);
  if (items) next.items = offerNull(items);
  const properties = asJsonObject(schema.properties);
  if (properties) {
    const required = requiredOf(schema);
    next.properties = Object.fromEntries(
      Object.entries(properties).map(([key, value]) => {
        const property = asJsonObject(value);
        if (!property) return [key, value];
        const inner = offerNull(property);
        if (required.has(key) || acceptsNull(inner)) return [key, inner];
        const { description, default: fallback, ...rest } = inner;
        return [
          key,
          {
            anyOf: [rest, { type: "null" }],
            ...(description !== undefined && { description }),
            ...(fallback !== undefined && { default: fallback }),
          },
        ];
      })
    );
  }
  return next;
};

/** Drops the `null` a model sent for a property {@link offerNull} made nullable. */
const omitOfferedNulls = (schema: JsonObject, value: JsonValue): JsonValue => {
  const items = asJsonObject(schema.items);
  const list = asJsonArray(value);
  if (items && list) return list.map((item) => omitOfferedNulls(items, item));
  const properties = asJsonObject(schema.properties);
  const record = asJsonObject(value);
  if (!properties || !record) return value;
  const required = requiredOf(schema);
  const cleaned: JsonObject = {};
  for (const [key, entry] of Object.entries(record)) {
    const property = asJsonObject(properties[key]);
    if (!property) {
      cleaned[key] = entry;
    } else if (entry !== null) {
      cleaned[key] = omitOfferedNulls(property, entry);
    } else if (required.has(key) || acceptsNull(property)) {
      cleaned[key] = null;
    }
  }
  return cleaned;
};

/**
 * The tool as Pi runs it for one turn. Pi validates and coerces the model's arguments against
 * the JSON Schema `parameters` before `execute`; the zod parse that follows applies what JSON
 * Schema cannot express and types the arguments for the tool.
 */
export const toPiTool = (
  tool: AgentTool,
  {
    policy,
    log,
  }: {
    policy: Pick<AgentPolicy, "toolInfo">;
    /** Identifies the turn beside a failed call in the log. */
    log: { sessionId: string; runId?: string };
  }
): PiAgentTool => {
  const json = asJsonObject(z.toJSONSchema(tool.parameters, { io: "input" }));
  if (!json) throw new Error(`\`${tool.name}\` has no JSON Schema.`);
  // The provider reads the schema inline; a dialect URI is noise to it.
  const { $schema: _dialect, ...schema } = json;
  const offered = offerNull(schema);
  return {
    name: tool.name,
    label: policy.toolInfo(tool.name).label,
    description: tool.description,
    // Pi validates plain JSON Schema as well as TypeBox: without TypeBox's kind symbol it
    // coerces and checks the arguments against the schema as written.
    parameters: offered,
    ...(tool.executionMode && { executionMode: tool.executionMode }),
    prepareArguments: (args) => {
      const json = asJsonValue(args);
      return json === undefined ? args : omitOfferedNulls(schema, json);
    },
    execute: (toolCallId, params, signal) =>
      traceToolCall(tool.name, toolCallId, async () => {
        try {
          const parsed = tool.parameters.safeParse(params);
          if (!parsed.success) throw new Error(z.prettifyError(parsed.error));
          const result = await tool.execute(parsed.data, {
            toolCallId,
            signal,
          });
          return {
            content: [{ type: "text", text: result.text }],
            details: asJsonValue(result.details),
          };
        } catch (error) {
          // Pi hands the throw to the model as an error result; the log is the only record of
          // what threw, and the model's input is as likely the cause as ours.
          logger.warn(
            { err: error, ...log, tool: tool.name, toolCallId },
            "Tool call failed"
          );
          throw error;
        }
      }),
  };
};
