import { describe, expect, it } from "vitest";

import {
  DETAILS_MAX_ARRAY_ITEMS,
  DETAILS_MAX_DEPTH,
  DETAILS_MAX_OBJECT_KEYS,
  DETAILS_MAX_STRING_CHARS,
  clipDetails,
} from "../src/wire/clip.ts";

describe("clipDetails", () => {
  it("passes small values through untouched", () => {
    const details = { post: { slug: "hello", tags: ["a", "b"] }, count: 2 };
    expect(clipDetails(details)).toEqual(details);
    expect(clipDetails(undefined)).toBeUndefined();
    expect(clipDetails(null)).toBeNull();
  });

  it("shortens long strings with an explicit marker", () => {
    const clipped = clipDetails(
      "y".repeat(DETAILS_MAX_STRING_CHARS + 5)
    ) as string;
    expect(clipped.startsWith("y".repeat(DETAILS_MAX_STRING_CHARS))).toBe(true);
    expect(clipped.endsWith("[truncated 5 chars]")).toBe(true);
  });

  it("caps arrays and wide objects and notes what was dropped", () => {
    const array = clipDetails(
      Array.from({ length: DETAILS_MAX_ARRAY_ITEMS + 3 }, (_, i) => i)
    ) as unknown[];
    expect(array).toHaveLength(DETAILS_MAX_ARRAY_ITEMS + 1);
    expect(array.at(-1)).toBe("… [3 more items]");

    const wide = clipDetails(
      Object.fromEntries(
        Array.from({ length: DETAILS_MAX_OBJECT_KEYS + 2 }, (_, i) => [
          `k${i}`,
          i,
        ])
      )
    ) as Record<string, unknown>;
    expect(Object.keys(wide)).toHaveLength(DETAILS_MAX_OBJECT_KEYS + 1);
    expect(wide["…"]).toBe("2 more keys");
  });

  it("stops descending past the depth cap", () => {
    let nested: unknown = "leaf";
    for (let i = 0; i < DETAILS_MAX_DEPTH + 2; i += 1) nested = { nested };
    let cursor = clipDetails(nested) as Record<string, unknown>;
    for (let i = 0; i < DETAILS_MAX_DEPTH - 1; i += 1) {
      cursor = cursor.nested as Record<string, unknown>;
    }
    expect(cursor.nested).toBe("[…]");
  });
});
