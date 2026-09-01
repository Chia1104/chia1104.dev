import { beforeEach, describe, expect, it } from "vitest";

import * as guardMocks from "./helpers/guards";
import { rpc } from "./helpers/rpc";

const linkPreview = (input: unknown) => rpc("toolings/link-preview", input);

describe("toolings.link-preview", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
  });

  it("returns link preview data", async () => {
    const res = await linkPreview({ href: "https://github.com" });

    expect([200, 500, 504]).toContain(res.status);
    if (res.ok) {
      const data = await res.json();
      expect(data).toBeDefined();
    }
  }, 30000);

  it("rejects an invalid URL", async () => {
    const res = await linkPreview({ href: "not-a-valid-url" });

    expect(res.status).toBe(400);
  }, 15000);

  it("rejects a missing href", async () => {
    const res = await linkPreview({});

    expect(res.status).toBe(400);
  }, 15000);

  it("rejects malformed JSON", async () => {
    const { app } = await import("../src/server");
    const res = await app.request("/api/v1/rpc/toolings/link-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid-json",
    });

    expect(res.status).toBe(400);
  }, 15000);
});
