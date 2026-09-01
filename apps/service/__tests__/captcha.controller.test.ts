const { mockVerify, mockSendContactEmail } = vi.hoisted(() => ({
  mockVerify: vi.fn(),
  mockSendContactEmail: vi.fn(),
}));

// The captcha guard must run; only the provider round trip and delivery are stubbed.
vi.unmock("@chia/api/orpc/guards/captcha.guard");

vi.mock("@chia/api/captcha", () => ({
  X_CAPTCHA_RESPONSE: "x-captcha-response",
  captchaSiteverifyWithCredentials: mockVerify,
}));

vi.mock("@chia/api/email", () => ({
  sendContactEmail: mockSendContactEmail,
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/server";

const send = (captchaToken?: string) =>
  app.request("/api/v1/rpc/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      json: {
        email: "a@b.co",
        title: "hello",
        message: "world!",
        ...(captchaToken === undefined ? {} : { captchaToken }),
      },
    }),
  });

describe("email.send captcha enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a missing captcha token at input validation", async () => {
    const res = await send();

    expect(res.status).toBe(400);
    expect(mockSendContactEmail).not.toHaveBeenCalled();
  });

  it("rejects a token the provider does not accept", async () => {
    mockVerify.mockResolvedValue({ success: false });

    const res = await send("invalid-token");

    expect(mockVerify).toHaveBeenCalledWith(
      expect.objectContaining({ token: "invalid-token" })
    );
    expect(res.status).toBe(400);
    expect(mockSendContactEmail).not.toHaveBeenCalled();
  });

  it("delivers only once the provider accepts the token", async () => {
    mockVerify.mockResolvedValue({ success: true });

    const res = await send("good-token");

    expect(res.status).toBe(200);
    expect(mockSendContactEmail).toHaveBeenCalledTimes(1);
  });
});
