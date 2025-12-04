import { expect, it, describe } from "bun:test";

import { app } from "@/server";

describe("Feeds Controller", () => {
  it("playing should be ok", async () => {
    const res = await app.request("/api/v1/spotify/playing");

    expect(res.ok).toBe(true);
  });

  it("playlist should be ok", async () => {
    const res = await app.request("/api/v1/spotify/playlist/default");

    expect(res.ok).toBe(true);
  });
});
