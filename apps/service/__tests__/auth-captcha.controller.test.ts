const { mockHandler, mockVerify } = vi.hoisted(() => ({
  mockHandler: vi.fn(),
  mockVerify: vi.fn(),
}));

vi.mock("@chia/api/captcha", () => ({
  X_CAPTCHA_RESPONSE: "x-captcha-response",
  captchaSiteverifyWithCredentials: mockVerify,
}));

vi.mock("@chia/auth/server", () => ({
  createAuth: () => ({ handler: mockHandler, api: { getSession: vi.fn() } }),
}));

import { beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../src/server";

/**
 * Sign-in entry points reachable by anyone (guest, social, magic link) sit behind the captcha;
 * the rest of better-auth's surface is untouched.
 */

const signIn = (path: string, captchaToken?: string) =>
  app.request(`/api/v1/auth${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(captchaToken === undefined
        ? {}
        : { "x-captcha-response": captchaToken }),
    },
    body: JSON.stringify({}),
  });

describe("auth sign-in captcha enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandler.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
  });

  it("refuses a guest sign-in with no token before better-auth sees it", async () => {
    const res = await signIn("/sign-in/anonymous");

    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("CAPTCHA_REQUIRED");
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("refuses a token the provider does not accept", async () => {
    mockVerify.mockResolvedValue({ success: false });

    const res = await signIn("/sign-in/social", "bad-token");

    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("CAPTCHA_FAILED");
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it("hands a verified request to better-auth", async () => {
    mockVerify.mockResolvedValue({ success: true });

    const res = await signIn("/sign-in/anonymous", "good-token");

    expect(res.status).toBe(200);
    expect(mockVerify).toHaveBeenCalledWith(
      expect.objectContaining({ token: "good-token" })
    );
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it("leaves the rest of the auth surface alone", async () => {
    const res = await app.request("/api/v1/auth/get-session");

    expect(res.status).toBe(200);
    expect(mockVerify).not.toHaveBeenCalled();
  });
});
