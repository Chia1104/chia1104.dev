import { describe, expect, it } from "vitest";

import { isUrl } from "./index";

describe("isUrl", () => {
  it("should return true if the url is valid", () => {
    expect(isUrl("https://www.google.com")).toBe(true);
  });

  it("test redis url", () => {
    expect(
      isUrl("redis://localhost:6379", {
        allowedProtocols: ["redis"],
      })
    ).toBe(true);
  });

  it("test valkey url", () => {
    expect(
      isUrl("valkey://localhost:6379", {
        allowedProtocols: ["valkey"],
      })
    ).toBe(true);
  });

  it("test postgres url", () => {
    expect(
      isUrl("postgres://localhost:5432/postgres", {
        allowedProtocols: ["postgres"],
      })
    ).toBe(true);
  });
});
