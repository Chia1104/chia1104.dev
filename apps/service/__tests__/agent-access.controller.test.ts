import { safe } from "@orpc/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAgentSessions } from "@chia/db/repos/agent";
import { CallerTier } from "@chia/service-kit/policies/caller.policy";
import * as dbMocks from "@chia/test/mocks/db-feeds";

import { setCallerTier } from "./helpers/guards";
import { client, errorCode } from "./helpers/rpc";

/**
 * Kind `minTier` is enforced at the guard, before session lookup or model load.
 * Writing admits only the configured admin.
 */

/** Stub the list read so a kind-less `list` stays about access, not rows. */
vi.mock("@chia/db/repos/agent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@chia/db/repos/agent")>()),
  getAgentSessions: vi.fn().mockResolvedValue([]),
}));

describe("agent kind access", () => {
  beforeEach(() => {
    dbMocks.resetAllDbMocks();
  });

  afterEach(() => {
    setCallerTier(CallerTier.Root);
  });

  it.each([
    ["anonymous", CallerTier.Anonymous],
    ["api-key", CallerTier.ApiKey],
  ] as const)(
    "refuses a %s caller, who has no user to own a session",
    async (_label, tier) => {
      setCallerTier(tier);

      const { error } = await safe(
        client.agent.capabilities.list({ kind: "writing" })
      );

      expect(errorCode(error)).toBe("UNAUTHORIZED");
    }
  );

  it("refuses a non-admin session on the writing kind", async () => {
    setCallerTier(CallerTier.Session);

    const { error } = await safe(
      client.agent.capabilities.list({ kind: "writing" })
    );

    expect(errorCode(error)).toBe("FORBIDDEN");
  });

  it("admits a guest to the agent surface but not to the writing kind", async () => {
    setCallerTier(CallerTier.Guest);

    // Guests own sessions, so list is 200 with an empty list.
    const list = await client.agent.sessions.list();
    expect(list).toEqual({ items: [], nextCursor: null });

    const { error } = await safe(
      client.agent.capabilities.list({ kind: "writing" })
    );
    expect(errorCode(error)).toBe("FORBIDDEN");
  });

  it.each([
    ["guest", CallerTier.Guest],
    ["signed-in", CallerTier.Session],
  ] as const)(
    "refuses a %s caller on the public kind",
    async (_label, tier) => {
      setCallerTier(tier);

      const { error } = await safe(
        client.agent.capabilities.list({ kind: "public" })
      );

      expect(errorCode(error)).toBe("FORBIDDEN");
    }
  );

  it("refuses the usage standing to a caller with no user to stand for", async () => {
    setCallerTier(CallerTier.ApiKey);

    const { error } = await safe(client.agent.usage.me());

    expect(errorCode(error)).toBe("UNAUTHORIZED");
  });

  it("refuses an explicit kind the caller may not use when listing", async () => {
    setCallerTier(CallerTier.Session);

    const { error } = await safe(
      client.agent.sessions.list({ kind: "writing" })
    );

    expect(errorCode(error)).toBe("FORBIDDEN");
  });

  it("lists only the kinds the caller may use when no kind is given", async () => {
    setCallerTier(CallerTier.Session);
    vi.mocked(getAgentSessions).mockClear();

    const data = await client.agent.sessions.list();

    expect(data).toEqual({ items: [], nextCursor: null });
    // A signed-in visitor may use neither kind, so the repository is never read.
    expect(vi.mocked(getAgentSessions)).not.toHaveBeenCalled();
  });

  it("admits the configured admin", async () => {
    setCallerTier(CallerTier.Root);

    await client.agent.capabilities.list({ kind: "writing" });
  });
});
