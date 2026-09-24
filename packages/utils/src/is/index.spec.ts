import { describe, expect, it } from "vitest";

import { isEnumValue, isUrl } from "./index";

describe("isUrl", () => {
  it("returns true for an https URL", () => {
    expect(isUrl("https://www.google.com")).toBe(true);
  });

  it("accepts a redis URL when redis is allowed", () => {
    expect(
      isUrl("redis://localhost:6379", {
        allowedProtocols: ["redis"],
      })
    ).toBe(true);
  });

  it("accepts a valkey URL when valkey is allowed", () => {
    expect(
      isUrl("valkey://localhost:6379", {
        allowedProtocols: ["valkey"],
      })
    ).toBe(true);
  });

  it("accepts a postgres URL when postgres is allowed", () => {
    expect(
      isUrl("postgres://localhost:5432/postgres", {
        allowedProtocols: ["postgres"],
      })
    ).toBe(true);
  });
});

describe("isEnumValue", () => {
  const Color = { Red: "red", Blue: "blue" } as const;

  it("accepts a member value", () => {
    expect(isEnumValue(Color, "red")).toBe(true);
  });

  it("rejects a key, an unknown value and a number", () => {
    expect(isEnumValue(Color, "Red")).toBe(false);
    expect(isEnumValue(Color, "green")).toBe(false);
    expect(isEnumValue(Color, 1)).toBe(false);
  });
});
