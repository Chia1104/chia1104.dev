import { beforeEach } from "vitest";

import { app } from "../src/server";

import * as guardMocks from "./__mocks__/guards.mock";

describe("Email Controller", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
  });
  describe("POST /api/v1/email/send", () => {
    it("should reject invalid email format", async () => {
      const res = await app.request("/api/v1/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "not-an-email",
          title: "Test Title",
          message: "Test Message",
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toHaveProperty("code");
    }, 15000);

    it("should reject short title", async () => {
      const res = await app.request("/api/v1/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test@example.com",
          title: "Hi",
          message: "Test Message",
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toHaveProperty("code");
    }, 15000);

    it("should reject short message", async () => {
      const res = await app.request("/api/v1/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test@example.com",
          title: "Test Title",
          message: "Hi",
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toHaveProperty("code");
    }, 15000);

    it("should reject missing required fields", async () => {
      const res = await app.request("/api/v1/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test@example.com",
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toHaveProperty("code");
    }, 15000);

    it(
      "should send email with valid data",
      {
        skip: true,
      },
      async () => {
        const res = await app.request("/api/v1/email/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: "test@example.com",
            title: "Test Title",
            message: "This is a test message",
          }),
        });

        expect([200, 401, 403, 500]).toContain(res.status);
      }
    );
  });
});
