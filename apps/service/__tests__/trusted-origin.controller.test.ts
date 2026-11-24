import { beforeEach, describe, expect, it } from "vitest";

import { CallerTier } from "@chia/auth/tier";

import { app } from "../src/server";

import * as guardMocks from "./helpers/guards";

/** `CORS_ALLOWED_ORIGIN` in `setup.ts`. */
const SITE = "http://localhost:3000";

/** Anonymous callers get 401 from this procedure, so 403 can only be the origin check. */
const PROCEDURE = "/api/v1/rpc/feeds/delete";

const postJSON = (headers: Record<string, string>) =>
  app.request(PROCEDURE, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ json: { feedId: 1 } }),
  });

describe("origin check outside the auth routes", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
    guardMocks.setCallerTier(CallerTier.Anonymous);
  });

  it("refuses a form another site posts, which needs no CORS preflight", async () => {
    const body = new FormData();
    body.set("data", JSON.stringify({ json: { feedId: 1 } }));

    const res = await app.request(PROCEDURE, {
      method: "POST",
      headers: { Origin: "https://evil.example" },
      body,
    });

    expect(res.status).toBe(403);
  });

  it("refuses an opaque origin", async () => {
    const res = await postJSON({ Origin: "null" });

    expect(res.status).toBe(403);
  });

  it("lets a trusted origin through to the procedure", async () => {
    const res = await postJSON({ Origin: SITE });

    expect(res.status).toBe(401);
  });

  it("lets a client that names no origin through to the procedure", async () => {
    const res = await postJSON({});

    expect(res.status).toBe(401);
  });
});
