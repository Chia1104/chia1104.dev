import { nodePgCodecs } from "drizzle-orm/node-postgres";
import * as z from "zod";

import type { JsonValue } from "@chia/utils/json";

/**
 * Two things a JavaScript string can hold that Postgres cannot store: NUL (`\0`), which `text`
 * rejects as an invalid byte and `jsonb` as an unsupported escape, and a lone UTF-16 surrogate,
 * which `jsonb` rejects as an unpaired escape. Model output and extracted documents produce both,
 * and neither has a storable spelling to preserve, so NUL is dropped and a lone surrogate becomes
 * U+FFFD.
 */
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

/** `base` with its parameters scrubbed before whatever it already did to them. */
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

/**
 * The node-postgres codecs with every text- and JSON-typed parameter scrubbed as it leaves
 * Drizzle. This is the one seam every write crosses — repositories, Better Auth's adapter, the
 * RAG indexer — so no caller has to know which strings Postgres refuses. Values bound to a raw
 * `sql` fragment without a column are not typed and pass through untouched.
 */
export const storableCodecs: typeof nodePgCodecs = {
  ...nodePgCodecs,
  char: scrubbing(nodePgCodecs.char),
  varchar: scrubbing(nodePgCodecs.varchar),
  text: scrubbing(nodePgCodecs.text),
  json: scrubbing(nodePgCodecs.json),
  jsonb: scrubbing(nodePgCodecs.jsonb),
};
