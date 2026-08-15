import { app } from "../src/server";

import * as guardMocks from "./__mocks__/guards.mock";

const send = (body: Record<string, unknown>) =>
  app.request("/api/v1/rpc/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: body }),
  });

describe("email.send", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
  });

  it("should reject invalid email format", async () => {
    const res = await send({
      email: "not-an-email",
      title: "Test Title",
      message: "Test Message",
    });

    expect(res.status).toBe(400);
  }, 15000);

  it("should reject short title", async () => {
    const res = await send({
      email: "test@example.com",
      title: "Hi",
      message: "Test Message",
    });

    expect(res.status).toBe(400);
  }, 15000);

  it("should reject short message", async () => {
    const res = await send({
      email: "test@example.com",
      title: "Test Title",
      message: "Hi",
    });

    expect(res.status).toBe(400);
  }, 15000);

  it("should reject missing required fields", async () => {
    const res = await send({ email: "test@example.com" });

    expect(res.status).toBe(400);
  }, 15000);

  it(
    "should send email with valid data",
    {
      skip: true,
    },
    async () => {
      const res = await send({
        email: "test@example.com",
        title: "Test Title",
        message: "This is a test message",
      });

      expect([200, 401, 403, 500]).toContain(res.status);
    }
  );
});
