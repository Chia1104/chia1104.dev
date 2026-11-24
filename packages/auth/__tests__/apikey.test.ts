import { describe, expect, it } from "vitest";

import {
  ApiKeyScope,
  apiKeyScopesSchema,
  generateApiKey,
  hashApiKey,
  toApiKeyScopes,
} from "../src/apikey";

describe("api key scopes", () => {
  it("drops stored values that have no scope name", () => {
    expect(
      toApiKeyScopes(["feeds:read", "feeds:publish", "github:read"])
    ).toEqual([ApiKeyScope.FeedsRead]);
  });

  it("requires at least one scope on the wire", () => {
    expect(apiKeyScopesSchema.safeParse([]).success).toBe(false);
    expect(apiKeyScopesSchema.safeParse(["feeds:admin"]).success).toBe(false);
    expect(apiKeyScopesSchema.safeParse(["feeds:read"]).success).toBe(true);
  });
});

describe("api key material", () => {
  it("stores only the hash and a display prefix of the raw key", async () => {
    const generated = await generateApiKey();

    expect(generated.key.startsWith("ch_")).toBe(true);
    expect(generated.start).toBe(generated.key.slice(0, 6));
    expect(generated.keyHash).not.toContain(generated.key);
    expect(await hashApiKey(generated.key)).toBe(generated.keyHash);
  });

  it("hashes as SHA-256 base64url without padding", async () => {
    // Known vector: SHA-256("abc").
    expect(await hashApiKey("abc")).toBe(
      "ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0"
    );
  });
});
