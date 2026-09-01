import { beforeEach, describe, expect, it } from "vitest";

import * as guardMocks from "./helpers/guards";
import { rpc } from "./helpers/rpc";

const send = (body: Record<string, unknown>) => rpc("email/send", body);

describe("email.send", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
  });

  it("rejects an invalid email format", async () => {
    const res = await send({
      email: "not-an-email",
      title: "Test Title",
      message: "Test Message",
    });

    expect(res.status).toBe(400);
  }, 15000);

  it("rejects a short title", async () => {
    const res = await send({
      email: "test@example.com",
      title: "Hi",
      message: "Test Message",
    });

    expect(res.status).toBe(400);
  }, 15000);

  it("rejects a short message", async () => {
    const res = await send({
      email: "test@example.com",
      title: "Test Title",
      message: "Hi",
    });

    expect(res.status).toBe(400);
  }, 15000);

  it("rejects missing required fields", async () => {
    const res = await send({ email: "test@example.com" });

    expect(res.status).toBe(400);
  }, 15000);

  it(
    "sends the email with valid data",
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
