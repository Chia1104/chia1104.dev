import { app } from "../src/server";

import * as guardMocks from "./__mocks__/guards.mock";

const invalidInput = { href: "not-a-url" };

describe("Error body shape per surface", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
  });

  it("REST emits the errorGenerator shape the frontends parse", async () => {
    const res = await app.request("/api/v1/toolings/link-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidInput),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      code: "Bad Request",
      status: 400,
      errors: [{ field: "href", message: "Invalid URL" }],
    });
  });

  it("RPC keeps oRPC's own shape, which its client requires", async () => {
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
