import { safe } from "@orpc/client";
import { beforeEach, describe, expect, it } from "vitest";

import { CallerTier } from "@chia/service-kit/policies/caller.policy";

import * as guardMocks from "./helpers/guards";
import { client, errorCode } from "./helpers/rpc";

describe("dashboard.access reports what the dashboard may show", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
  });

  it("names the configured admin an operator", async () => {
    guardMocks.setCallerTier(CallerTier.Root);

    await expect(client.dashboard.access()).resolves.toEqual({
      level: "operator",
    });
  });

  it("names any other signed-in person a member", async () => {
    guardMocks.setCallerTier(CallerTier.Session);

    await expect(client.dashboard.access()).resolves.toEqual({
      level: "member",
    });
  });

  it("refuses a guest", async () => {
    guardMocks.setCallerTier(CallerTier.Guest);

    const { error } = await safe(client.dashboard.access());

    expect(errorCode(error)).toBe("FORBIDDEN");
  });

  it("refuses an anonymous visitor", async () => {
    guardMocks.setCallerTier(CallerTier.Anonymous);

    const { error } = await safe(client.dashboard.access());

    expect(errorCode(error)).toBe("UNAUTHORIZED");
  });
});
