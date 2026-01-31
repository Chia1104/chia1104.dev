import { beforeEach } from "vitest";

import { app } from "../src/server";

import * as dbMocks from "./__mocks__/db.mock";
import * as guardMocks from "./__mocks__/guards.mock";

describe("Feeds Controller", () => {
  beforeEach(() => {
    dbMocks.resetAllDbMocks();
    guardMocks.resetAllGuardMocks();
  });
  describe("GET /api/v1/feeds/public", () => {
    it("should return public feeds", async () => {
      const res = await app.request("/api/v1/feeds/public");

      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("items");
      expect(data).toHaveProperty("meta");
    }, 15000);

    it("should handle limit parameter", async () => {
      const res = await app.request("/api/v1/feeds/public?limit=5");

      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.items).toBeDefined();
      expect(Array.isArray(data.items)).toBe(true);
    }, 15000);

    it("should reject invalid limit parameter", async () => {
      const res = await app.request(
        "/api/v1/feeds/public?limit=foo&orderBy=updatedAt"
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toHaveProperty("code");
    }, 15000);

    it("should handle orderBy parameter", async () => {
      const res = await app.request(
        "/api/v1/feeds/public?orderBy=createdAt&sortOrder=desc"
      );

      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty("items");
    }, 15000);

    it("should handle locale parameter", async () => {
      const res = await app.request("/api/v1/feeds/public?locale=en");

      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty("items");
    }, 15000);
  });
});
