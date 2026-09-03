import { describe, expect, it } from "vitest";

import { ApiKeyScope } from "@chia/auth/apikey";

import {
  apiKeyFormSchema,
  formValuesOf,
  stateOf,
} from "../src/components/api-keys/form";
import type { ApiKeyView } from "../src/components/api-keys/form";

const key = (overrides: Partial<ApiKeyView> = {}): ApiKeyView => ({
  id: "k1",
  key: "hashed",
  name: "www",
  start: "ch_ab12",
  prefix: "ch_",
  referenceId: "u1",
  configId: "default",
  refillInterval: null,
  refillAmount: null,
  enabled: true,
  rateLimitEnabled: false,
  rateLimitTimeWindow: null,
  rateLimitMax: null,
  requestCount: 3,
  remaining: null,
  metadata: null,
  permissions: { feeds: ["read"], spotify: ["read"] },
  lastRequest: null,
  lastRefillAt: null,
  expiresAt: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  ...overrides,
});

describe("api key form", () => {
  it("seeds the form from the stored permissions record", () => {
    expect(formValuesOf(key())).toEqual({
      name: "www",
      scopes: [ApiKeyScope.FeedsRead, ApiKeyScope.SpotifyRead],
    });
  });

  it("refuses a blank name or an empty scope list", () => {
    expect(
      apiKeyFormSchema.safeParse({ name: "  ", scopes: ["feeds:read"] }).success
    ).toBe(false);
    expect(
      apiKeyFormSchema.safeParse({ name: "www", scopes: [] }).success
    ).toBe(false);
    expect(
      apiKeyFormSchema.parse({ name: " www ", scopes: ["feeds:read"] })
    ).toEqual({ name: "www", scopes: ["feeds:read"] });
  });
});

describe("stateOf", () => {
  const now = new Date("2026-09-03T00:00:00Z").getTime();

  it("reports a disabled key as revoked before looking at expiry", () => {
    expect(
      stateOf(
        key({ enabled: false, expiresAt: "2026-01-01T00:00:00.000Z" }),
        now
      )
    ).toBe("revoked");
  });

  it("reports a past expiry as expired and everything else as active", () => {
    expect(stateOf(key({ expiresAt: "2026-01-01T00:00:00.000Z" }), now)).toBe(
      "expired"
    );
    expect(stateOf(key({ expiresAt: "2027-01-01T00:00:00.000Z" }), now)).toBe(
      "active"
    );
    expect(stateOf(key(), now)).toBe("active");
  });
});
