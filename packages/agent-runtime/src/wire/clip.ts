/**
 * Bounds a tool's `details` before it crosses the wire.
 *
 * `details` is the per-tool view model and is written verbatim to the run's durable stream, then
 * replayed to every reconnecting client. A `get_post` result carries a whole post body, so an
 * unbounded payload turns one tool call into tens of kilobytes of durable writes and replay. The
 * clip keeps the shape (clients render `details` as JSON, and tool cards read known keys) and only
 * shortens what is inside it: long strings, long arrays, wide objects, deep nesting, and — the bound
 * that actually holds — a total character budget shared by the whole value, after which every
 * further leaf becomes a marker. The model never sees this copy — it reads the tool's `content`.
 */

export const DETAILS_MAX_STRING_CHARS = 8_000;
export const DETAILS_MAX_ARRAY_ITEMS = 100;
export const DETAILS_MAX_OBJECT_KEYS = 100;
export const DETAILS_MAX_DEPTH = 8;
/** Upper bound on the characters of text and keys kept across the whole value. */
export const DETAILS_MAX_TOTAL_CHARS = 64_000;

const OMITTED = "[…]";

const createClipper = () => {
  let remaining = DETAILS_MAX_TOTAL_CHARS;

  /** Takes up to `wanted` characters from the budget; returns how many were granted. */
  const take = (wanted: number): number => {
    const granted = Math.max(0, Math.min(wanted, remaining));
    remaining -= granted;
    return granted;
  };

  const clipString = (value: string): string => {
    const cap = Math.min(value.length, DETAILS_MAX_STRING_CHARS);
    const kept = take(cap);
    if (kept >= value.length) return value;
    return `${value.slice(0, kept)}… [truncated ${value.length - kept} chars]`;
  };

  const clipValue = (value: unknown, depth: number): unknown => {
    if (typeof value === "string") return clipString(value);
    if (typeof value !== "object" || value === null) return value;
    if (depth >= DETAILS_MAX_DEPTH || remaining <= 0) return OMITTED;

    if (Array.isArray(value)) {
      const items: unknown[] = [];
      let index = 0;
      for (
        ;
        index < value.length && index < DETAILS_MAX_ARRAY_ITEMS;
        index += 1
      ) {
        if (remaining <= 0) break;
        items.push(clipValue(value[index], depth + 1));
      }
      if (index < value.length) {
        items.push(`… [${value.length - index} more items]`);
      }
      return items;
    }

    const entries = Object.entries(value as Record<string, unknown>);
    const kept: Record<string, unknown> = {};
    let index = 0;
    for (
      ;
      index < entries.length && index < DETAILS_MAX_OBJECT_KEYS;
      index += 1
    ) {
      if (remaining <= 0) break;
      const [key, item] = entries[index]!;
      // A key is kept whole or not at all; one that does not fit ends the object here.
      if (take(key.length) < key.length) break;
      kept[key] = clipValue(item, depth + 1);
    }
    if (index < entries.length) {
      kept["…"] = `${entries.length - index} more keys`;
    }
    return kept;
  };

  return clipValue;
};

export const clipDetails = (details: unknown): unknown =>
  details === undefined ? undefined : createClipper()(details, 0);
