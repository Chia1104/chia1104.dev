import * as z from "zod";

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

const jsonValueSchema: z.ZodType<JsonValue> = z.json();
const jsonObjectSchema = z.record(z.string(), jsonValueSchema);
const jsonArraySchema = z.array(jsonValueSchema);
const stringSchema = z.compile(z.string());
const numberSchema = z.compile(z.number());

export const asJsonValue = <TValue>(value: TValue) =>
  jsonValueSchema.safeParse(value).data;

export const asJsonObject = <TValue>(value: TValue) =>
  jsonObjectSchema.safeParse(value).data;

export const asJsonArray = <TValue>(value: TValue) =>
  jsonArraySchema.safeParse(value).data;

export const asString = <TValue>(value: TValue) =>
  stringSchema.safeParse(value).data;

export const asNumber = <TValue>(value: TValue) =>
  numberSchema.safeParse(value).data;

/** Recursively sorts object keys so equal values stringify identically. */
export const stableStringify = (value: JsonValue): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const record = jsonObjectSchema.safeParse(value).data;
  if (record !== undefined) {
    return `{${Object.keys(record)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableStringify(record[key] ?? null)}`
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
};
