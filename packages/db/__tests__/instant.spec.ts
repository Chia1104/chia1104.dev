import { describe, expect, it } from "vitest";

import { cursorTransform, parseInstant } from "../src/libs/index.ts";

describe("parseInstant", () => {
  it("reads epoch milliseconds from a number or numeric string", () => {
    const epoch = 1_693_728_000_000;
    expect(parseInstant(epoch).getTime()).toBe(epoch);
    expect(parseInstant(String(epoch)).getTime()).toBe(epoch);
  });

  it("reads an ISO timestamp", () => {
    const iso = "2024-01-01T00:00:00.000Z";
    expect(parseInstant(iso).toISOString()).toBe(iso);
  });
});

describe("cursorTransform", () => {
  it("turns a date-mode cursor into a Date", () => {
    const epoch = 1_693_728_000_000;
    expect(cursorTransform(epoch, "date")).toEqual(new Date(epoch));
  });

  it("leaves a default-mode cursor unchanged", () => {
    expect(cursorTransform("abc")).toBe("abc");
  });
});
