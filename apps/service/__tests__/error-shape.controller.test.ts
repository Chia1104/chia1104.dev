import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/server";

import * as guardMocks from "./helpers/guards";

const invalidInput = { href: "not-a-url" };

describe("Error body shape", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
  });

  it("RPC emits oRPC's own shape, which its client requires", async () => {
    const res = await app.request("/api/v1/rpc/toolings/link-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: invalidInput }),
    });

    expect(res.status).toBe(400);

    const body = (await res.json()) as { json: Record<string, unknown> };

    expect(body.json).toMatchObject({
      defined: true,
      code: "BAD_REQUEST",
      status: 400,
    });
  });
});
