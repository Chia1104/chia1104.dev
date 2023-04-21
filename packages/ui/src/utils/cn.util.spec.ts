import { describe, expect, test } from "vitest";
import { cn } from "./cn.util";

describe("cn", () => {
  test("should return empty string", () => {
    expect(cn()).toBe("");
  });
  test("should return 'w-5 flex'", () => {
    expect(cn("w-5", "flex")).toBe("w-5 flex");
  });
  test("should return 'w-5 flex'", () => {
    expect(cn("w-4 w-5 flex")).toBe("w-5 flex");
  });
});
