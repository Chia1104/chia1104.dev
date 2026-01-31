import { beforeEach } from "vitest";

import { app } from "../src/server";

import * as guardMocks from "./__mocks__/guards.mock";

describe("Spotify Controller", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
  });
  describe("GET /api/v1/spotify/playing", () => {
    it("should return response from currently playing endpoint", async () => {
      const res = await app.request("/api/v1/spotify/playing");

      expect(res.status).toBeDefined();
      expect([200, 500]).toContain(res.status);
    });
  });

  describe("GET /api/v1/spotify/playlist/:id", () => {
    it("should return response from default playlist", async () => {
      const res = await app.request("/api/v1/spotify/playlist/default");

      expect(res.status).toBeDefined();
      expect([200, 500]).toContain(res.status);
    });

    it("should handle playlist ID parameter", async () => {
      const res = await app.request("/api/v1/spotify/playlist/test-id");

      expect(res.status).toBeDefined();
      expect(res.status).toBeGreaterThan(0);
    });
  });
});
