import { expect, it, describe } from "bun:test";

import { app } from "@/server";

describe("Feeds Controller", () => {
  it("should be ok", async () => {
    const res = await app.request("/feeds");

    expect(res.ok).toBe(true);
  });

  it("bad limit request", async () => {
    const res = await app.request("/feeds?limit=foo");

    expect(res.status).toBe(400);
  });
});
