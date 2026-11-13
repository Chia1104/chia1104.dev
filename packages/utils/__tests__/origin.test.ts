import { describe, expect, it } from "vitest";

import { X_ORIGIN_SECRET, isOriginRequestAllowed } from "../src/server/origin";

const SECRET = "a".repeat(64);

const headers = (init: Record<string, string>) => new Headers(init);

describe("isOriginRequestAllowed", () => {
  it("refuses a request from Railway's public edge without the secret", () => {
    expect(
      isOriginRequestAllowed(headers({ "x-railway-edge": "sin1" }), SECRET)
    ).toBe(false);
  });

  it("refuses a wrong secret, including one of a different length", () => {
    expect(
      isOriginRequestAllowed(
        headers({
          "x-railway-edge": "sin1",
          [X_ORIGIN_SECRET]: "b".repeat(64),
        }),
        SECRET
      )
    ).toBe(false);
    expect(
      isOriginRequestAllowed(
        headers({ "x-railway-edge": "sin1", [X_ORIGIN_SECRET]: "a" }),
        SECRET
      )
    ).toBe(false);
  });

  it("allows a request from the edge that carries the secret", () => {
    expect(
      isOriginRequestAllowed(
        headers({ "x-railway-edge": "sin1", [X_ORIGIN_SECRET]: SECRET }),
        SECRET
      )
    ).toBe(true);
  });

  it("allows requests that never passed the edge", () => {
    expect(isOriginRequestAllowed(headers({}), SECRET)).toBe(true);
  });

  it("allows everything when no secret is configured", () => {
    expect(
      isOriginRequestAllowed(headers({ "x-railway-edge": "sin1" }), undefined)
    ).toBe(true);
  });
});
