import { beforeEach } from "vitest";

import { app } from "../src/server";

import * as guardMocks from "./__mocks__/guards.mock";

describe("Admin Controller", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
  });
  describe("GET /api/v1/admin/public/feeds:meta", () => {
    it("should return feeds metadata (mock skips auth)", async () => {
      const res = await app.request("/api/v1/admin/public/feeds:meta");

      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty("total");
    });
  });

  describe("GET /api/v1/admin/public/feeds", () => {
    it("should return feeds list (mock skips auth)", async () => {
      const res = await app.request("/api/v1/admin/public/feeds");

      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty("items");
      expect(data).toHaveProperty("meta");
    });
  });

  describe("GET /api/v1/admin/public/feeds/:slug", () => {
    it("should return feed by slug (mock skips auth)", async () => {
      const res = await app.request("/api/v1/admin/public/feeds/test-slug");

      expect([200, 404]).toContain(res.status);
    });
  });

  describe("GET /api/v1/admin/public/feeds:id/:id", () => {
    it("should return feed by ID (mock skips auth)", async () => {
      const res = await app.request("/api/v1/admin/public/feeds:id/1");

      expect([200, 404]).toContain(res.status);
    });

    it("should reject invalid ID format", async () => {
      const res = await app.request("/api/v1/admin/public/feeds:id/invalid");

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/v1/admin/public/feeds:translation", () => {
    it("should handle translation request (mock skips auth)", async () => {
      const res = await app.request("/api/v1/admin/public/feeds:translation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      expect([200, 400, 404]).toContain(res.status);
    });
  });

  describe("POST /api/v1/admin/public/feeds:content", () => {
    it("should handle content request (mock skips auth)", async () => {
      const res = await app.request("/api/v1/admin/public/feeds:content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      expect([200, 400, 404]).toContain(res.status);
    });
  });

  describe("POST /api/v1/admin/public/feeds/:id", () => {
    it("should handle feed update (mock skips auth)", async () => {
      const res = await app.request("/api/v1/admin/public/feeds/1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      expect([200, 400, 404]).toContain(res.status);
    });
  });
});
