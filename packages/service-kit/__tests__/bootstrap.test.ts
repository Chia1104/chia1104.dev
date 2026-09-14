import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { bootstrap } from "../src/bootstrap";
import { AppError } from "../src/errors";

const createApp = () =>
  bootstrap(new Hono(), { logger: false })
    .get("/ok", (c) => c.json({ requestId: c.get("requestId") }))
    .get("/refused", () => {
      throw new AppError("FORBIDDEN");
    })
    .get("/broken", () => {
      throw new Error("boom");
    });

describe("bootstrap request id", () => {
  it("echoes the id it hands the handler", async () => {
    const res = await createApp().request("/ok");
    const id = res.headers.get("X-Request-Id");

    expect(id).toBeTruthy();
    await expect(res.json()).resolves.toEqual({ requestId: id });
  });

  it("keeps the id on error responses", async () => {
    const app = createApp();

    for (const path of ["/refused", "/broken"]) {
      const res = await app.request(path);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.headers.get("X-Request-Id")).toBeTruthy();
    }
  });
});
