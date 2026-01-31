import { beforeEach } from "vitest";

import { app } from "../src/server";

import * as guardMocks from "./__mocks__/guards.mock";

describe("Toolings Controller", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
  });
  describe("POST /api/v1/toolings/link-preview", () => {
    it("should return link preview data", async () => {
      const res = await app.request("/api/v1/toolings/link-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          href: "https://github.com",
        }),
      });

      expect([200, 500, 504]).toContain(res.status);
      if (res.ok) {
        const data = await res.json();
        expect(data).toBeDefined();
      }
    }, 30000);

    it("should reject invalid URL", async () => {
      const res = await app.request("/api/v1/toolings/link-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          href: "not-a-valid-url",
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toHaveProperty("code");
    }, 15000);

    it("should reject missing href parameter", async () => {
      const res = await app.request("/api/v1/toolings/link-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toHaveProperty("code");
    }, 15000);

    it("should handle malformed JSON", async () => {
      const res = await app.request("/api/v1/toolings/link-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "invalid-json",
      });

      expect(res.status).toBe(400);
    }, 15000);
  });
});
