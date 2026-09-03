import { describe, expect, it } from "vitest";

import {
  ApiKeyScope,
  apiKeyScopesSchema,
  hasApiKeyScope,
  toApiKeyPermissions,
  toApiKeyScopes,
} from "../src/apikey";

describe("api key scopes", () => {
  it("folds scopes into better-auth's resource to actions record", () => {
    expect(
      toApiKeyPermissions([
        ApiKeyScope.FeedsRead,
        ApiKeyScope.FeedsWrite,
        ApiKeyScope.FeedsRead,
        ApiKeyScope.SpotifyRead,
      ])
    ).toEqual({ feeds: ["read", "write"], spotify: ["read"] });
  });

  it("round-trips a record back to the scopes the UI knows", () => {
    expect(toApiKeyScopes({ feeds: ["write"], spotify: ["read"] })).toEqual([
      ApiKeyScope.FeedsWrite,
      ApiKeyScope.SpotifyRead,
    ]);
  });

  it("drops resources and actions that have no scope name", () => {
    expect(
      toApiKeyScopes({ feeds: ["read", "publish"], github: ["read"] })
    ).toEqual([ApiKeyScope.FeedsRead]);
  });

  it("treats a key without permissions as having no scope", () => {
    expect(hasApiKeyScope(null, ApiKeyScope.FeedsRead)).toBe(false);
    expect(hasApiKeyScope({}, ApiKeyScope.FeedsRead)).toBe(false);
    expect(hasApiKeyScope({ feeds: ["read"] }, ApiKeyScope.FeedsRead)).toBe(
      true
    );
  });

  it("requires at least one scope on the wire", () => {
    expect(apiKeyScopesSchema.safeParse([]).success).toBe(false);
    expect(apiKeyScopesSchema.safeParse(["feeds:admin"]).success).toBe(false);
    expect(apiKeyScopesSchema.safeParse(["feeds:read"]).success).toBe(true);
  });
});
