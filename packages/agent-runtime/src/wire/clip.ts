/**
 * Bounds a tool's `details` before it crosses the wire.
 *
 * `details` is the per-tool view model and is written verbatim to the run's durable stream, then
 * replayed to every reconnecting client. A `get_post` result carries a whole post body, so an
 * unbounded payload turns one tool call into tens of kilobytes of durable writes and replay. The
 * clip keeps the shape (clients render `details` as JSON, and tool cards read known keys) and only
 * shortens what is inside it: long strings, long arrays, wide objects and deep nesting. The model
 * never sees this copy — it reads the tool's `content`.
 */

export const DETAILS_MAX_STRING_CHARS = 8_000;
export const DETAILS_MAX_ARRAY_ITEMS = 100;
export const DETAILS_MAX_OBJECT_KEYS = 100;
export const DETAILS_MAX_DEPTH = 8;

const clipString = (value: string): string =>
  value.length <= DETAILS_MAX_STRING_CHARS
    ? value
    : `${value.slice(0, DETAILS_MAX_STRING_CHARS)}… [truncated ${value.length - DETAILS_MAX_STRING_CHARS} chars]`;

const clipValue = (value: unknown, depth: number): unknown => {
  if (typeof value === "string") return clipString(value);
  if (typeof value !== "object" || value === null) return value;
  if (depth >= DETAILS_MAX_DEPTH) return "[…]";

  if (Array.isArray(value)) {
    const items = value
      .slice(0, DETAILS_MAX_ARRAY_ITEMS)
      .map((item) => clipValue(item, depth + 1));
    if (value.length > DETAILS_MAX_ARRAY_ITEMS) {
      items.push(`… [${value.length - DETAILS_MAX_ARRAY_ITEMS} more items]`);
    }
    return items;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const kept = Object.fromEntries(
    entries
      .slice(0, DETAILS_MAX_OBJECT_KEYS)
      .map(([key, item]) => [key, clipValue(item, depth + 1)])
  );
  if (entries.length > DETAILS_MAX_OBJECT_KEYS) {
    kept["…"] = `${entries.length - DETAILS_MAX_OBJECT_KEYS} more keys`;
  }
  return kept;
};

export const clipDetails = (details: unknown): unknown =>
  details === undefined ? undefined : clipValue(details, 0);
