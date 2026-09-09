import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db/client";
import { listAgentKindConfigs } from "@chia/db/repos/agent/config";

import { resolveAccess } from "../src/access";
import { CallerTier, agentKindFloor } from "../src/tier";

vi.mock("@chia/db/repos/agent/config", () => ({
  listAgentKindConfigs: vi.fn(),
}));

/* SAFETY: the repository read is mocked, so the handle is never touched. */
const db = {} as DB;
const ADMIN_ID = "admin";
const options = {
  agentKinds: { writing: CallerTier.Root, public: CallerTier.Guest },
};

const publicRow = (minTier: number | null) => ({
  kind: "public",
  minTier,
  providerId: null,
  modelId: null,
  thinkingLevel: null,
  autoApprove: null,
  config: {},
  updatedAt: new Date(),
});

describe("agentKindFloor", () => {
  it("raises the definition's floor but never lowers it", () => {
    expect(agentKindFloor(CallerTier.Guest, CallerTier.Session)).toBe(
      CallerTier.Session
    );
    expect(agentKindFloor(CallerTier.Root, CallerTier.Guest)).toBe(
      CallerTier.Root
    );
  });

  it("ignores a null or unknown override", () => {
    expect(agentKindFloor(CallerTier.Guest, null)).toBe(CallerTier.Guest);
    expect(agentKindFloor(CallerTier.Guest, 9)).toBe(CallerTier.Guest);
  });
});

describe("resolveAccess", () => {
  beforeEach(() => {
    vi.mocked(listAgentKindConfigs).mockResolvedValue([]);
  });

  it("grades a guest with no dashboard and the code floors", async () => {
    const access = await resolveAccess(
      db,
      { id: "g1", role: "user", isAnonymous: true },
      ADMIN_ID,
      options
    );

    expect(access).toEqual({
      tier: CallerTier.Guest,
      dashboard: null,
      agent: { writing: CallerTier.Root, public: CallerTier.Guest },
    });
  });

  it("names a signed-in person a member and the configured admin an operator", async () => {
    const member = await resolveAccess(
      db,
      { id: "u1", role: "user" },
      ADMIN_ID,
      options
    );
    expect(member.tier).toBe(CallerTier.Session);
    expect(member.dashboard).toBe("member");

    const operator = await resolveAccess(
      db,
      { id: ADMIN_ID, role: "root" },
      ADMIN_ID,
      options
    );
    expect(operator.tier).toBe(CallerTier.Root);
    expect(operator.dashboard).toBe("operator");
  });

  it("a root role without the configured id is still a member", async () => {
    const access = await resolveAccess(
      db,
      { id: "u2", role: "root" },
      ADMIN_ID,
      options
    );

    expect(access.dashboard).toBe("member");
  });

  it("reports the operator's raised floor for a kind", async () => {
    vi.mocked(listAgentKindConfigs).mockResolvedValue([
      publicRow(CallerTier.Session),
    ]);

    const access = await resolveAccess(
      db,
      { id: "g1", role: "user", isAnonymous: true },
      ADMIN_ID,
      options
    );

    expect(access.agent.public).toBe(CallerTier.Session);
    expect(access.tier).toBeLessThan(access.agent.public);
  });
});
