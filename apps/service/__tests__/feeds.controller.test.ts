import { expect, it, describe } from "bun:test";

import { app } from "@/server";

describe("Feeds Controller", () => {
  it("should be ok", async () => {
    const res = await app.request("/feeds/public");

    expect(res.ok).toBe(true);
  });

  it("bad limit request", async () => {
    const res = await app.request("/feeds/public?limit=foo&orderBy=updatedAt");

    expect(res.status).toBe(400);
  });
});
