import { describe, expect, it } from "vitest";

import {
  asJsonArray,
  asJsonObject,
  asJsonValue,
  asNumber,
  asString,
  stableStringify,
} from "./index.ts";

describe("JSON value narrowing", () => {
  it("narrows JSON containers and primitives", () => {
    expect(asJsonValue({ nested: [true, null] })).toEqual({
      nested: [true, null],
    });
    expect(asJsonObject({ id: 1 })).toEqual({ id: 1 });
    expect(asJsonArray([1, "two"])).toEqual([1, "two"]);
    expect(asString("value")).toBe("value");
    expect(asNumber(42)).toBe(42);
  });

  it("rejects mismatched and non-JSON values", () => {
    expect(asJsonObject([])).toBeUndefined();
    expect(asJsonArray({})).toBeUndefined();
    expect(asString(1)).toBeUndefined();
    expect(asNumber("1")).toBeUndefined();
    expect(asJsonValue({ missing: undefined })).toBeUndefined();
  });
});

describe("stableStringify", () => {
  it("sorts object keys recursively without reordering arrays", () => {
    expect(stableStringify({ z: 1, a: { y: false, x: [3, 2, 1] } })).toBe(
      '{"a":{"x":[3,2,1],"y":false},"z":1}'
    );
  });
});
