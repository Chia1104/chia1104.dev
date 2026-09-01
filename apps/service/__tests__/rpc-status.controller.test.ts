import { beforeEach, describe, expect, it } from "vitest";

import { CallerTier } from "@chia/service-kit/policies/caller.policy";
import * as dbMocks from "@chia/test/mocks/db-feeds";

import * as guardMocks from "./helpers/guards";
import { rpc } from "./helpers/rpc";

describe("RPCHandler errorStatusMap", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
    dbMocks.resetAllDbMocks();
  });

  it("maps UNAUTHORIZED to 401", async () => {
    guardMocks.setCallerTier(CallerTier.Anonymous);

    const res = await rpc("feeds/delete", { feedId: 1 });

    expect(res.status).toBe(401);
  });

  it("maps FORBIDDEN to 403", async () => {
    guardMocks.setCallerTier(CallerTier.ApiKey);

    const res = await rpc("feeds/delete", { feedId: 1 });

    expect(res.status).toBe(403);
  });

  it("maps NOT_FOUND to 404", async () => {
    guardMocks.setCallerTier(CallerTier.ApiKey);
    dbMocks.upsertContent.mockResolvedValue(undefined);

    const res = await rpc("feeds/content:upsert", {
      feedTranslationId: 999,
      content: "# hello",
    });

    expect(res.status).toBe(404);
  });
});
