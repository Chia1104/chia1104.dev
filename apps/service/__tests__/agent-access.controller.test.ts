import { getAgentSessions } from "@chia/db/repos/agent";
import { CallerTier } from "@chia/service-kit/policies/caller.policy";

import { app } from "../src/server";

import * as dbMocks from "./__mocks__/db.mock";
import { setCallerTier } from "./__mocks__/guards.mock";

/**
 * Who may reach an agent kind is the kind's `minTier`, enforced by the agent guards rather than
 * by a role pinned on the routes. The writing kind admits only the configured admin, so these
 * assert that a lower tier is refused at the guard — before any session lookup or model load.
 */

/**
 * The public kind is open to every session-bearing tier, so a kind-less `list` now reaches the
 * repository for it; stub that one read so the test stays about access, not rows.
 */
vi.mock("@chia/db/repos/agent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@chia/db/repos/agent")>()),
  getAgentSessions: vi.fn().mockResolvedValue([]),
}));

const rpc = (procedure: string, input?: Record<string, unknown>) =>
  app.request(`/api/v1/rpc/agent/${procedure}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });

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

      const res = await rpc("capabilities/list", { kind: "writing" });

      expect(res.status).toBe(401);
    }
  );

  it("refuses a non-admin session on the writing kind", async () => {
    setCallerTier(CallerTier.Session);

    const res = await rpc("capabilities/list", { kind: "writing" });

    expect(res.status).toBe(403);
  });

  it("admits a guest to the agent surface but not to the writing kind", async () => {
    setCallerTier(CallerTier.Guest);

    // A guest has a user to own sessions, so the floor lets them in: an empty list, not 401.
    const list = await rpc("sessions/list");
    expect(list.status).toBe(200);

    const writing = await rpc("capabilities/list", { kind: "writing" });
    expect(writing.status).toBe(403);
  });

  it.each([
    ["guest", CallerTier.Guest],
    ["signed-in", CallerTier.Session],
  ] as const)("admits a %s caller to the public kind", async (_label, tier) => {
    setCallerTier(tier);

    const res = await rpc("capabilities/list", { kind: "public" });

    expect(res.status).toBe(200);
    const { json } = await res.json();
    expect(json.tools.length).toBeGreaterThan(0);
    expect(
      json.tools.every((tool: { tier: string }) => tool.tier === "read")
    ).toBe(true);
  });

  it("refuses the usage standing to a caller with no user to stand for", async () => {
    setCallerTier(CallerTier.ApiKey);

    const res = await rpc("usage/me");

    expect(res.status).toBe(401);
  });

  it("refuses an explicit kind the caller may not use when listing", async () => {
    setCallerTier(CallerTier.Session);

    const res = await rpc("sessions/list", { kind: "writing" });

    expect(res.status).toBe(403);
  });

  it("lists only the kinds the caller may use when no kind is given", async () => {
    setCallerTier(CallerTier.Session);
    vi.mocked(getAgentSessions).mockClear();

    const res = await rpc("sessions/list");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      json: { items: [], nextCursor: null },
    });
    // A signed-in visitor may use the public kind and nothing else, so that is the only read.
    expect(
      vi.mocked(getAgentSessions).mock.calls.map(([, input]) => input)
    ).toEqual([expect.objectContaining({ kind: "public" })]);
  });

  it("admits the configured admin", async () => {
    setCallerTier(CallerTier.Root);

    const res = await rpc("capabilities/list", { kind: "writing" });

    expect(res.status).toBe(200);
  });
});
