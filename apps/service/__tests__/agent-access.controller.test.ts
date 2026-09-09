import { safe } from "@orpc/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CallerTier } from "@chia/auth/tier";
import { getAgentSessions } from "@chia/db/repos/agent";
import {
  getAgentKindConfig,
  listAgentKindConfigs,
} from "@chia/db/repos/agent/config";
import * as dbMocks from "@chia/test/mocks/db-feeds";

import { setCallerTier } from "./helpers/guards";
import { client, errorCode } from "./helpers/rpc";

/**
 * A kind's floor is enforced at the guard, before session lookup or model load: the
 * definition's floor raised by the operator's `kind_config` override. Writing admits only
 * the configured admin; public admits guests unless the operator raised it.
 */

/** Stub the list read so a kind-less `list` stays about access, not rows. */
vi.mock("@chia/db/repos/agent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@chia/db/repos/agent")>()),
  getAgentSessions: vi.fn().mockResolvedValue([]),
}));

vi.mock("@chia/db/repos/agent/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@chia/db/repos/agent/config")>()),
  getAgentKindConfig: vi.fn().mockResolvedValue(undefined),
  listAgentKindConfigs: vi.fn().mockResolvedValue([]),
}));

/** The operator raised the public kind to `minTier`; every other column defers to the code. */
const raisePublicTo = (minTier: CallerTier) => {
  const row = {
    kind: "public",
    minTier,
    providerId: null,
    modelId: null,
    thinkingLevel: null,
    autoApprove: null,
    config: {},
    updatedAt: new Date(),
  };
  vi.mocked(getAgentKindConfig).mockImplementation((_db, kind) =>
    Promise.resolve(kind === "public" ? row : undefined)
  );
  vi.mocked(listAgentKindConfigs).mockResolvedValue([row]);
};

describe("agent kind access", () => {
  beforeEach(() => {
    dbMocks.resetAllDbMocks();
    vi.mocked(getAgentKindConfig).mockResolvedValue(undefined);
    vi.mocked(listAgentKindConfigs).mockResolvedValue([]);
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

  it("admits a guest to the public kind at the definition's floor", async () => {
    setCallerTier(CallerTier.Guest);

    await client.agent.capabilities.list({ kind: "public" });
  });

  it.each([
    ["guest", CallerTier.Guest],
    ["signed-in", CallerTier.Session],
  ] as const)(
    "refuses a %s caller on the public kind once the operator raised it to Root",
    async (_label, tier) => {
      raisePublicTo(CallerTier.Root);
      setCallerTier(tier);

      const { error } = await safe(
        client.agent.capabilities.list({ kind: "public" })
      );

      expect(errorCode(error)).toBe("FORBIDDEN");
    }
  );

  it("refuses a guest but admits a signed-in person once the public kind is raised to Session", async () => {
    raisePublicTo(CallerTier.Session);

    setCallerTier(CallerTier.Guest);
    const { error } = await safe(
      client.agent.capabilities.list({ kind: "public" })
    );
    expect(errorCode(error)).toBe("FORBIDDEN");

    setCallerTier(CallerTier.Session);
    await client.agent.capabilities.list({ kind: "public" });
  });

  it("never lowers a kind below its definition's floor", async () => {
    vi.mocked(getAgentKindConfig).mockResolvedValue({
      kind: "writing",
      minTier: CallerTier.Guest,
      providerId: null,
      modelId: null,
      thinkingLevel: null,
      autoApprove: null,
      config: {},
      updatedAt: new Date(),
    });
    setCallerTier(CallerTier.Session);

    const { error } = await safe(
      client.agent.capabilities.list({ kind: "writing" })
    );

    expect(errorCode(error)).toBe("FORBIDDEN");
  });

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
    raisePublicTo(CallerTier.Root);
    setCallerTier(CallerTier.Session);
    vi.mocked(getAgentSessions).mockClear();

    const data = await client.agent.sessions.list();

    expect(data).toEqual({ items: [], nextCursor: null });
    // With public raised, a signed-in visitor may use neither kind, so the repository is never read.
    expect(vi.mocked(getAgentSessions)).not.toHaveBeenCalled();
  });

  it("admits the configured admin", async () => {
    setCallerTier(CallerTier.Root);

    await client.agent.capabilities.list({ kind: "writing" });
  });
});
