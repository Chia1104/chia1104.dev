import { app } from "../src/server";

import * as dbMocks from "./__mocks__/db.mock";
import * as guardMocks from "./__mocks__/guards.mock";

interface OpenAPIDocument {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
}

describe("OpenAPI Controller", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
    dbMocks.resetAllDbMocks();
  });

  describe("GET /api/v1/openapi.json", () => {
    it("serves a generated OpenAPI document", async () => {
      const res = await app.request("/api/v1/openapi.json");

      expect(res.ok).toBe(true);

      const doc = (await res.json()) as OpenAPIDocument;

      expect(doc.openapi).toMatch(/^3\./);
      expect(doc.info.version).toBe("1.0.0");
      expect(Object.keys(doc.paths).length).toBeGreaterThan(0);
    });

    it("covers every contract group", async () => {
      const res = await app.request("/api/v1/openapi.json");
      const doc = (await res.json()) as OpenAPIDocument;
      const paths = Object.keys(doc.paths).join("\n");

      for (const group of [
        "health",
        "apikey",
        "feeds",
        "organization",
        "file",
        "user",
        "spotify",
      ]) {
        expect(paths).toContain(group);
      }
    });
  });

  describe("REST surface over the oRPC router", () => {
    it("routes an unmatched Hono path to the oRPC OpenAPI handler", async () => {
      // `health.client` sits behind `authGuard`; reaching it at all proves the handler
      // is mounted — a missing mount would 404 instead.
      const res = await app.request("/api/v1/health/client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      expect(res.status).toBe(401);
    });

    it("leaves hand-written Hono routes taking precedence", async () => {
      const res = await app.request("/api/v1/health");

      expect(res.ok).toBe(true);
      expect(await res.json()).toEqual({ status: "ok" });
    });
  });
});
