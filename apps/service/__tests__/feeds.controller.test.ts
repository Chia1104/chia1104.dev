import { expect, it } from "bun:test";

import { app } from "@/server";

it("test", async () => {
  const res = await app.request("/feeds");

  expect(res.ok).toBe(true);
});
