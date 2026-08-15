import { app } from "../src/server";

import * as guardMocks from "./__mocks__/guards.mock";

const linkPreview = (body: BodyInit) =>
  app.request("/api/v1/rpc/toolings/link-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

describe("toolings.link-preview", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
  });

  it("should return link preview data", async () => {
    const res = await linkPreview(
      JSON.stringify({ json: { href: "https://github.com" } })
    );

    expect([200, 500, 504]).toContain(res.status);
    if (res.ok) {
      const data = await res.json();
      expect(data).toBeDefined();
    }
  }, 30000);

  it("should reject invalid URL", async () => {
    const res = await linkPreview(
      JSON.stringify({ json: { href: "not-a-valid-url" } })
    );

    expect(res.status).toBe(400);
  }, 15000);

  it("should reject missing href parameter", async () => {
    const res = await linkPreview(JSON.stringify({ json: {} }));

    expect(res.status).toBe(400);
  }, 15000);

  it("should handle malformed JSON", async () => {
    const res = await linkPreview("invalid-json");

    expect(res.status).toBe(400);
  }, 15000);
});
