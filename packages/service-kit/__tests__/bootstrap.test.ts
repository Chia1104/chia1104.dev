const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }));

vi.mock("@chia/observability/report", () => ({ reportError }));

import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyPolicy } from "../src/adapters/hono";
import { bootstrap } from "../src/bootstrap";
import { AppError } from "../src/errors";
import { deny } from "../src/policies/types";

const createApp = () =>
  bootstrap(new Hono(), { logger: false })
    .get("/ok", (c) => c.json({ requestId: c.get("requestId") }))
    .get("/refused", () => {
      throw new AppError("FORBIDDEN");
    })
    .get("/broken", () => {
      throw new Error("boom");
    })
    .get("/denied/:code", async (c) => {
      const code =
        c.req.param("code") === "503" ? "SERVICE_UNAVAILABLE" : "FORBIDDEN";
      const denied = await applyPolicy(c, async () =>
        deny(new AppError(code, { headers: { "Retry-After": "30" } }))
      );
      return denied ?? c.json({ ok: true });
    });

beforeEach(() => {
  reportError.mockClear();
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

describe("policy denials", () => {
  it("answers a 4xx denial in place without reporting it", async () => {
    const res = await createApp().request("/denied/403");

    expect(res.status).toBe(403);
    expect(reportError).not.toHaveBeenCalled();
  });

  it("reports a 5xx denial once and keeps its status and headers", async () => {
    const res = await createApp().request("/denied/503");

    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.any(AppError),
      "Request failed",
      expect.objectContaining({ requestId: expect.any(String) })
    );
  });
});
