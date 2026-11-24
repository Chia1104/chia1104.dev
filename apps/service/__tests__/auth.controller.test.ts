const { mockVerify, service, mockFinish } = vi.hoisted(() => ({
  mockVerify: vi.fn(),
  mockFinish: vi.fn(),
  service: {
    signInWithOAuth: vi.fn(),
    startGuestSession: vi.fn(),
    endSession: vi.fn(),
  },
}));

vi.mock("@chia/integrations/captcha", () => ({
  X_CAPTCHA_RESPONSE: "x-captcha-response",
  captchaSiteverifyWithCredentials: mockVerify,
}));

vi.mock("@chia/services/auth/auth.service", () => service);

vi.mock("@chia/auth/oauth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@chia/auth/oauth")>()),
  finishOAuthFlow: mockFinish,
}));

import { beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../src/server";

/** `CORS_ALLOWED_ORIGIN` in `setup.ts`. */
const SITE = "http://localhost:3000";

const post = (
  path: string,
  options: { body?: unknown; captcha?: string; origin?: string | null } = {}
) =>
  app.request(`/api/v1/auth${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.origin === null ? {} : { Origin: options.origin ?? SITE }),
      ...(options.captcha === undefined
        ? {}
        : { "x-captcha-response": options.captcha }),
    },
    body: JSON.stringify(options.body ?? {}),
  });

const grant = {
  token: "session-token",
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
};

/** Starts a Google flow and returns the flow cookie and the state the provider would echo. */
const startFlow = async (callbackURL = `${SITE}/chat`) => {
  const res = await post("/sign-in/social", {
    body: { provider: "google", callbackURL },
    captcha: "good-token",
  });
  const body: unknown = res.ok ? await res.json() : null;
  const url =
    body && typeof body === "object" && "url" in body ? String(body.url) : "";
  return {
    res,
    url: new URL(url || "about:blank"),
    cookie: res.headers.get("set-cookie")?.split(";")[0] ?? "",
  };
};

describe("auth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerify.mockResolvedValue({ success: true });
    service.startGuestSession.mockResolvedValue(grant);
    service.signInWithOAuth.mockResolvedValue({ ok: true, grant });
    mockFinish.mockResolvedValue({
      providerId: "google",
      accountId: "g-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
    });
  });

  describe("captcha", () => {
    it("refuses a guest sign-in with no token before minting anything", async () => {
      const res = await post("/sign-in/guest");

      expect(res.status).toBe(400);
      expect(JSON.stringify(await res.json())).toContain("CAPTCHA_REQUIRED");
      expect(service.startGuestSession).not.toHaveBeenCalled();
    });

    it("refuses a token the provider does not accept", async () => {
      mockVerify.mockResolvedValue({ success: false });

      const res = await post("/sign-in/social", {
        body: { provider: "google", callbackURL: SITE },
        captcha: "bad-token",
      });

      expect(res.status).toBe(400);
      expect(JSON.stringify(await res.json())).toContain("CAPTCHA_FAILED");
    });

    it("sets the session cookie for a verified guest", async () => {
      const res = await post("/sign-in/guest", { captcha: "good-token" });

      expect(res.status).toBe(200);
      expect(res.headers.get("set-cookie")).toContain(
        "chia1104.dev.session=session-token"
      );
      expect(res.headers.get("set-cookie")).toContain("HttpOnly");
    });
  });

  it("refuses a POST from an origin outside the allow-list", async () => {
    for (const origin of ["https://evil.example", null]) {
      const res = await post("/sign-out", { origin });
      expect(res.status).toBe(403);
    }
    expect(service.endSession).not.toHaveBeenCalled();
  });

  describe("OAuth", () => {
    it("refuses to return anywhere but a trusted origin", async () => {
      const { res } = await startFlow("https://evil.example/steal");

      expect(res.status).toBe(400);
    });

    it("sends the browser to the provider with state and a PKCE challenge", async () => {
      const { url, cookie } = await startFlow();

      expect(url.origin).toBe("https://accounts.google.com");
      expect(url.searchParams.get("redirect_uri")).toBe(
        "http://localhost:3000/api/v1/auth/callback/google"
      );
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      expect(url.searchParams.get("state")).toHaveLength(43);
      expect(cookie).toMatch(/^chia1104\.dev\.oauth=/);
    });

    it("signs in and returns to the callback URL", async () => {
      const { url, cookie } = await startFlow();
      const state = url.searchParams.get("state") ?? "";

      const res = await app.request(
        `/api/v1/auth/callback/google?code=c&state=${state}`,
        { headers: { Cookie: cookie } }
      );

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe(`${SITE}/chat`);
      expect(res.headers.get("set-cookie")).toContain(
        "chia1104.dev.session=session-token"
      );
      expect(mockFinish).toHaveBeenCalledWith(
        expect.objectContaining({ state }),
        "c"
      );
    });

    it("refuses a callback whose state the browser did not start", async () => {
      const { cookie } = await startFlow();

      const res = await app.request(
        "/api/v1/auth/callback/google?code=c&state=forged",
        { headers: { Cookie: cookie } }
      );

      expect(res.headers.get("location")).toBe(
        `${SITE}/chat?error=invalid_callback`
      );
      expect(mockFinish).not.toHaveBeenCalled();
    });

    it("refuses a callback with no flow cookie at all", async () => {
      const res = await app.request(
        "/api/v1/auth/callback/google?code=c&state=s"
      );

      expect(res.status).toBe(400);
      expect(service.signInWithOAuth).not.toHaveBeenCalled();
    });

    it("returns a refused sign-in with its reason", async () => {
      service.signInWithOAuth.mockResolvedValue({
        ok: false,
        reason: "banned",
      });
      const { url, cookie } = await startFlow();

      const res = await app.request(
        `/api/v1/auth/callback/google?code=c&state=${url.searchParams.get("state")}`,
        { headers: { Cookie: cookie } }
      );

      expect(res.headers.get("location")).toBe(`${SITE}/chat?error=banned`);
      expect(res.headers.get("set-cookie")).not.toContain(
        "chia1104.dev.session=session-token"
      );
    });
  });

  it("ends the session and clears the cookie on sign-out", async () => {
    const res = await app.request("/api/v1/auth/sign-out", {
      method: "POST",
      headers: { Origin: SITE, Cookie: "chia1104.dev.session=old-token" },
    });

    expect(res.status).toBe(200);
    expect(service.endSession).toHaveBeenCalledWith(
      expect.anything(),
      "old-token"
    );
    expect(res.headers.get("set-cookie")).toContain("chia1104.dev.session=;");
  });
});
