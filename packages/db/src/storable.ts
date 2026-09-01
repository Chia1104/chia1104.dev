import { nodePgCodecs } from "drizzle-orm/node-postgres";
import * as z from "zod";

import type { JsonValue } from "@chia/utils/json";

/** Postgres `text`/`jsonb` reject NUL and unpaired UTF-16 surrogates. NUL is dropped; a lone surrogate becomes U+FFFD. */
const UNSTORABLE =
  /\0|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export const toStorableString = (value: string): string =>
  value.replace(UNSTORABLE, (match) => (match === "\0" ? "" : "�"));

const jsonObjectSchema = z.record(z.string(), z.json());

/** {@link toStorableString} over every string in a JSON value, keys included. */
export const toStorableJson = (value: JsonValue): JsonValue => {
  const text = z.string().safeParse(value).data;
  if (text !== undefined) return toStorableString(text);
  if (Array.isArray(value)) return value.map(toStorableJson);
  const record = jsonObjectSchema.safeParse(value).data;
  if (record !== undefined) {
    return Object.fromEntries(
      Object.entries(record).map(([key, item]) => [
        toStorableString(key),
        toStorableJson(item),
      ])
    );
  }
  return value;
};

type Codec = NonNullable<typeof nodePgCodecs.jsonb>;

/** Scrubs parameters before `base`'s own normalizers. */
const scrubbing = ({
  normalizeParam = (value: JsonValue) => value,
  normalizeParamArray = (value: JsonValue) => value,
  ...rest
}: Codec = {}): Codec => ({
  ...rest,
  normalizeParam: (value: JsonValue) => normalizeParam(toStorableJson(value)),
  normalizeParamArray: (value: JsonValue, dimensions: number) =>
    normalizeParamArray(toStorableJson(value), dimensions),
});

/** Scrubs every text and JSON parameter as it leaves Drizzle. Untyped values in a raw `sql` fragment pass through. */
export const storableCodecs: typeof nodePgCodecs = {
  ...nodePgCodecs,
  char: scrubbing(nodePgCodecs.char),
  varchar: scrubbing(nodePgCodecs.varchar),
  text: scrubbing(nodePgCodecs.text),
  json: scrubbing(nodePgCodecs.json),
  jsonb: scrubbing(nodePgCodecs.jsonb),
};
