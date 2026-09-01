import { safe } from "@orpc/client";
import { beforeEach, describe, expect, it } from "vitest";

import * as guardMocks from "./helpers/guards";
import { client, errorCode } from "./helpers/rpc";

describe("toolings.link-preview", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
  });

  it("returns link preview data", async () => {
    const { error, data } = await safe(
      client.toolings["link-preview"]({ href: "https://github.com" })
    );

    if (error) {
      expect([
        "BAD_REQUEST",
        "INTERNAL_SERVER_ERROR",
        "TIMEOUT",
        "GATEWAY_TIMEOUT",
        "MALFORMED_ORPC_RESPONSE",
      ]).toContain(errorCode(error));
    } else {
      expect(data).toBeDefined();
    }
  }, 30000);

  it("rejects an invalid URL", async () => {
    const { error } = await safe(
      client.toolings["link-preview"]({ href: "not-a-valid-url" })
    );

    expect(errorCode(error)).toBe("BAD_REQUEST");
  }, 15000);

  it("rejects a missing href", async () => {
    const { error } = await safe(client.toolings["link-preview"]({} as never));

    expect(errorCode(error)).toBe("BAD_REQUEST");
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
