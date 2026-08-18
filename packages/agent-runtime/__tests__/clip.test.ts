import { describe, expect, it } from "vitest";
import * as z from "zod";

import type { JsonValue } from "@chia/db/json";

import {
  DETAILS_MAX_ARRAY_ITEMS,
  DETAILS_MAX_DEPTH,
  DETAILS_MAX_OBJECT_KEYS,
  DETAILS_MAX_STRING_CHARS,
  DETAILS_MAX_TOTAL_CHARS,
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
    const clipped =
      /* SAFETY: This fixture implements the string members exercised by this case. */ clipDetails(
        "y".repeat(DETAILS_MAX_STRING_CHARS + 5)
      ) as string;
    expect(clipped.startsWith("y".repeat(DETAILS_MAX_STRING_CHARS))).toBe(true);
    expect(clipped.endsWith("[truncated 5 chars]")).toBe(true);
  });

  it("caps arrays and wide objects and notes what was dropped", () => {
    const array =
      /* SAFETY: This fixture implements the unknown[] members exercised by this case. */ clipDetails(
        Array.from({ length: DETAILS_MAX_ARRAY_ITEMS + 3 }, (_, i) => i)
      ) as unknown[];
    expect(array).toHaveLength(DETAILS_MAX_ARRAY_ITEMS + 1);
    expect(array.at(-1)).toBe("… [3 more items]");

    const wide = z
      .record(z.string(), z.json())
      .parse(
        clipDetails(
          Object.fromEntries(
            Array.from({ length: DETAILS_MAX_OBJECT_KEYS + 2 }, (_, i) => [
              `k${i}`,
              i,
            ])
          )
        )
      );
    expect(Object.keys(wide)).toHaveLength(DETAILS_MAX_OBJECT_KEYS + 1);
    expect(wide["…"]).toBe("2 more keys");
  });

  it("stops descending past the depth cap", () => {
    let nested: JsonValue = "leaf";
    for (let i = 0; i < DETAILS_MAX_DEPTH + 2; i += 1) nested = { nested };
    let cursor = z.record(z.string(), z.json()).parse(clipDetails(nested));
    for (let i = 0; i < DETAILS_MAX_DEPTH - 1; i += 1) {
      cursor = z.record(z.string(), z.json()).parse(cursor.nested);
    }
    expect(cursor.nested).toBe("[…]");
  });

  it("bounds the whole value, not just each part", () => {
    // Every part is within its own cap, but together they are ~800K characters.
    const details = {
      posts: Array.from({ length: DETAILS_MAX_ARRAY_ITEMS }, (_, i) => ({
        slug: `post-${i}`,
        body: "z".repeat(DETAILS_MAX_STRING_CHARS),
      })),
    };

    const clipped =
      /* SAFETY: This fixture implements the { posts: unknown[] } members exercised by this case. */ clipDetails(
        details
      ) as { posts: unknown[] };
    const serialized = JSON.stringify(clipped);

    // Markers and JSON punctuation ride on top of the budget, but not by much.
    expect(serialized.length).toBeLessThan(DETAILS_MAX_TOTAL_CHARS * 1.25);
    expect(clipped.posts.length).toBeLessThan(DETAILS_MAX_ARRAY_ITEMS);
    expect(clipped.posts.at(-1)).toMatch(/more items/);
    expect(clipped.posts[0]).toMatchObject({ slug: "post-0" });
  });

  it("keeps a key whole or not at all", () => {
    const longKey = "k".repeat(DETAILS_MAX_TOTAL_CHARS + 10);
    const clipped = z
      .record(z.string(), z.json())
      .parse(clipDetails({ first: 1, [longKey]: 2, last: 3 }));

    expect(clipped.first).toBe(1);
    expect(Object.keys(clipped).some((key) => key.length > 1_000)).toBe(false);
    expect(clipped["…"]).toBe("2 more keys");
    expect(JSON.stringify(clipped).length).toBeLessThan(
      DETAILS_MAX_TOTAL_CHARS
    );
  });
});
