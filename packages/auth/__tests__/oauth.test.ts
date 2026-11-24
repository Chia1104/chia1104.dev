import { afterEach, describe, expect, it, vi } from "vitest";

import { OAuthCodeRefusedError, finishOAuthFlow } from "../src/oauth";
import { OAuthProvider } from "../src/types";

const flow = {
  provider: OAuthProvider.Google,
  state: "s".repeat(43),
  codeVerifier: "v".repeat(43),
  callbackURL: "http://localhost:3000",
};

/** A provider answer as these tests need it: flat JSON. */
type ProviderBody = Record<string, string | boolean>;

const json = (body: ProviderBody, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Google redeems the code, then vouches for `email`. */
const stubVerifiedEmail = (email: string) =>
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      Promise.resolve(
        url.endsWith("/token")
          ? json({ access_token: "access-token" })
          : json({ sub: "g-1", email, email_verified: true })
      )
    )
  );

const stubTokenResponse = (body: ProviderBody, status: number) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(json(body, status)))
  );

describe("finishOAuthFlow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lowercases a plain address", async () => {
    stubVerifiedEmail("Ada@Example.COM");

    const identity = await finishOAuthFlow(flow, "code");

    expect(identity?.email).toBe("ada@example.com");
  });

  it("refuses an address that only becomes someone's after folding", async () => {
    // Fullwidth `a`, then the Kelvin sign, which lowercases to an ASCII `k`.
    for (const email of ["ａda@example.com", "Kate@example.com"]) {
      stubVerifiedEmail(email);

      expect(await finishOAuthFlow(flow, "code")).toBeNull();
    }
  });

  it("separates a refused code from a failure of ours", async () => {
    stubTokenResponse({ error: "invalid_grant" }, 400);
    await expect(finishOAuthFlow(flow, "code")).rejects.toBeInstanceOf(
      OAuthCodeRefusedError
    );

    stubTokenResponse({ error: "invalid_client" }, 401);
    await expect(finishOAuthFlow(flow, "code")).rejects.not.toBeInstanceOf(
      OAuthCodeRefusedError
    );
  });
});
