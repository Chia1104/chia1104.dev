import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db/client";
import type { AgentQuotaConfig } from "@chia/db/schema";
import { isAppError } from "@chia/service-kit/errors";
import { CallerTier } from "@chia/service-kit/policies/caller.policy";

/**
 * Quota is a tier policy over the operator's row and the ledger. The week is
 * Monday-to-Monday in the zone; Root is exempt; only house spend counts; a stale
 * zone degrades to the default.
 */

const { repo } = vi.hoisted(() => ({
  repo: {
    getAgentQuotaConfig: vi.fn(),
    sumAgentUsageCost: vi.fn(),
    lockAgentUser: vi.fn(),
    countRunningAgentTurns: vi.fn(),
  },
}));

vi.mock("@chia/db/repos/agent/config", () => ({
  getAgentQuotaConfig: repo.getAgentQuotaConfig,
}));
vi.mock("@chia/db/repos/agent/usage", () => ({
  sumAgentUsageCost: repo.sumAgentUsageCost,
}));
vi.mock("@chia/db/repos/agent", () => ({
  lockAgentUser: repo.lockAgentUser,
  countRunningAgentTurns: repo.countRunningAgentTurns,
}));

const db =
  /* SAFETY: the repos are mocked; nothing reads the handle. */ {} as DB;

const row = (overrides: Partial<AgentQuotaConfig> = {}): AgentQuotaConfig => ({
  id: "default",
  weeklyLimitMicros: null,
  resetTimeZone: null,
  maxRunningTurns: null,
  updatedAt: new Date("2026-08-27T00:00:00Z"),
  ...overrides,
});

const iso = (date: Date) => date.toISOString();

describe("weekPeriod", () => {
  it("is Monday 00:00 to the next in a fixed-offset zone", async () => {
    const { weekPeriod } = await import("../src/quota");
    // Saturday 18:00 in Taipei.
    const period = weekPeriod(new Date("2026-08-29T10:00:00Z"), "Asia/Taipei");
    expect(iso(period.start)).toBe("2026-08-23T16:00:00.000Z");
    expect(iso(period.end)).toBe("2026-08-30T16:00:00.000Z");
  });

  it("keeps Sunday in the week that started the previous Monday", async () => {
    const { weekPeriod } = await import("../src/quota");
    // Sunday 20:00 in Taipei.
    const period = weekPeriod(new Date("2026-08-30T12:00:00Z"), "Asia/Taipei");
    expect(iso(period.start)).toBe("2026-08-23T16:00:00.000Z");
  });

  it("starts a new week at the instant of Monday midnight", async () => {
    const { weekPeriod } = await import("../src/quota");
    const monday = new Date("2026-08-30T16:00:00Z");
    expect(iso(weekPeriod(monday, "Asia/Taipei").start)).toBe(iso(monday));
    expect(
      iso(weekPeriod(new Date(monday.getTime() - 1), "Asia/Taipei").end)
    ).toBe(iso(monday));
  });

  it("follows the zone across a DST transition", async () => {
    const { weekPeriod } = await import("../src/quota");
    // New York springs forward on 2026-03-08. The week around it starts in EST (UTC-5) and ends
    // in EDT (UTC-4): 6 days and 23 hours long.
    const across = weekPeriod(
      new Date("2026-03-06T12:00:00Z"),
      "America/New_York"
    );
    expect(iso(across.start)).toBe("2026-03-02T05:00:00.000Z");
    expect(iso(across.end)).toBe("2026-03-09T04:00:00.000Z");
    const after = weekPeriod(
      new Date("2026-03-10T12:00:00Z"),
      "America/New_York"
    );
    expect(iso(after.start)).toBe("2026-03-09T04:00:00.000Z");
    expect(iso(after.end)).toBe("2026-03-16T04:00:00.000Z");
  });

  it("is plain UTC weeks in UTC", async () => {
    const { weekPeriod } = await import("../src/quota");
    const period = weekPeriod(new Date("2026-01-01T00:00:00Z"), "UTC");
    expect(iso(period.start)).toBe("2025-12-29T00:00:00.000Z");
    expect(iso(period.end)).toBe("2026-01-05T00:00:00.000Z");
  });
});

describe("effectiveAgentQuota", () => {
  it("is the code defaults without a row: $0.30 a week in the system zone", async () => {
    const { AGENT_QUOTA_DEFAULTS, effectiveAgentQuota, systemTimeZone } =
      await import("../src/quota");
    expect(effectiveAgentQuota(undefined)).toEqual(AGENT_QUOTA_DEFAULTS);
    expect(AGENT_QUOTA_DEFAULTS.weeklyLimitMicros).toBe(300_000);
    expect(AGENT_QUOTA_DEFAULTS.resetTimeZone).toBe(systemTimeZone());
    expect(AGENT_QUOTA_DEFAULTS.maxRunningTurns).toBe(3);
  });

  it("takes each override on its own", async () => {
    const { AGENT_QUOTA_DEFAULTS, effectiveAgentQuota } =
      await import("../src/quota");
    expect(effectiveAgentQuota(row({ weeklyLimitMicros: 1_000_000 }))).toEqual({
      weeklyLimitMicros: 1_000_000,
      resetTimeZone: AGENT_QUOTA_DEFAULTS.resetTimeZone,
      maxRunningTurns: AGENT_QUOTA_DEFAULTS.maxRunningTurns,
    });
    expect(effectiveAgentQuota(row({ resetTimeZone: "Europe/Paris" }))).toEqual(
      {
        weeklyLimitMicros: AGENT_QUOTA_DEFAULTS.weeklyLimitMicros,
        resetTimeZone: "Europe/Paris",
        maxRunningTurns: AGENT_QUOTA_DEFAULTS.maxRunningTurns,
      }
    );
  });

  it("ignores a zone the runtime does not know", async () => {
    const { AGENT_QUOTA_DEFAULTS, effectiveAgentQuota, isTimeZone } =
      await import("../src/quota");
    expect(isTimeZone("Mars/Olympus_Mons")).toBe(false);
    expect(
      effectiveAgentQuota(row({ resetTimeZone: "Mars/Olympus_Mons" }))
        .resetTimeZone
    ).toBe(AGENT_QUOTA_DEFAULTS.resetTimeZone);
  });
});

describe("assertWithinAgentQuota", () => {
  const now = new Date("2026-08-29T10:00:00Z");
  const session = { tier: CallerTier.Session, userId: "user-1" };

  beforeEach(() => {
    vi.clearAllMocks();
    repo.getAgentQuotaConfig.mockResolvedValue(
      row({ resetTimeZone: "Asia/Taipei" })
    );
    repo.sumAgentUsageCost.mockResolvedValue(0);
  });

  it("never reads Root against the quota", async () => {
    const { assertWithinAgentQuota } = await import("../src/quota");
    await assertWithinAgentQuota(
      db,
      { tier: CallerTier.Root, userId: "admin" },
      now
    );
    expect(repo.getAgentQuotaConfig).not.toHaveBeenCalled();
    expect(repo.sumAgentUsageCost).not.toHaveBeenCalled();
  });

  it("sums only house spend, over the caller's current week", async () => {
    const { assertWithinAgentQuota } = await import("../src/quota");
    repo.sumAgentUsageCost.mockResolvedValue(299_999);

    await assertWithinAgentQuota(db, session, now);

    expect(repo.sumAgentUsageCost).toHaveBeenCalledExactlyOnceWith(db, {
      userId: "user-1",
      from: new Date("2026-08-23T16:00:00Z"),
      to: new Date("2026-08-30T16:00:00Z"),
      providerIds: ["vercel-ai-gateway"],
    });
  });

  it("refuses once the week's spend reaches the limit, saying when it resets", async () => {
    const { assertWithinAgentQuota } = await import("../src/quota");
    repo.sumAgentUsageCost.mockResolvedValue(300_000);

    const error = await assertWithinAgentQuota(db, session, now).catch(
      (cause: unknown) => cause
    );

    expect(isAppError(error) && error.code).toBe("QUOTA_EXCEEDED");
    expect(isAppError(error) && error.data).toEqual({
      limitMicros: 300_000,
      usedMicros: 300_000,
      resetAt: "2026-08-30T16:00:00.000Z",
      timeZone: "Asia/Taipei",
    });
    expect(isAppError(error) && error.message).toContain("$0.3");
  });

  it("closes the agent to limited tiers when the limit is zero", async () => {
    const { assertWithinAgentQuota } = await import("../src/quota");
    repo.getAgentQuotaConfig.mockResolvedValue(row({ weeklyLimitMicros: 0 }));

    await expect(assertWithinAgentQuota(db, session, now)).rejects.toThrow(
      "Weekly usage limit"
    );
  });
});

describe("assertBelowRunningTurnCap", () => {
  const session = { tier: CallerTier.Session, userId: "user-1" };

  beforeEach(() => {
    vi.clearAllMocks();
    repo.getAgentQuotaConfig.mockResolvedValue(undefined);
    repo.lockAgentUser.mockResolvedValue(undefined);
    repo.countRunningAgentTurns.mockResolvedValue(0);
  });

  it("never counts Root", async () => {
    const { assertBelowRunningTurnCap } = await import("../src/quota");
    await assertBelowRunningTurnCap(db, {
      tier: CallerTier.Root,
      userId: "admin",
    });
    expect(repo.lockAgentUser).not.toHaveBeenCalled();
    expect(repo.countRunningAgentTurns).not.toHaveBeenCalled();
  });

  it("locks the user before counting their running turns", async () => {
    const { assertBelowRunningTurnCap } = await import("../src/quota");
    const order: string[] = [];
    repo.lockAgentUser.mockImplementation(async () => {
      order.push("lock");
    });
    repo.countRunningAgentTurns.mockImplementation(async () => {
      order.push("count");
      return 2;
    });

    await assertBelowRunningTurnCap(db, session);

    expect(order).toEqual(["lock", "count"]);
    expect(repo.lockAgentUser).toHaveBeenCalledWith(db, "user-1");
    expect(repo.countRunningAgentTurns).toHaveBeenCalledWith(db, {
      userId: "user-1",
      turnKey: "turn",
    });
  });

  it("refuses at the cap, saying how many are running", async () => {
    const { assertBelowRunningTurnCap } = await import("../src/quota");
    repo.countRunningAgentTurns.mockResolvedValue(3);

    const error = await assertBelowRunningTurnCap(db, session).catch(
      (cause: unknown) => cause
    );

    expect(isAppError(error) && error.code).toBe("TOO_MANY_REQUESTS");
    expect(isAppError(error) && error.data).toEqual({
      runningTurns: 3,
      maxRunningTurns: 3,
    });
  });

  it("follows the operator's cap, and zero closes new turns", async () => {
    const { assertBelowRunningTurnCap } = await import("../src/quota");
    repo.getAgentQuotaConfig.mockResolvedValue(row({ maxRunningTurns: 5 }));
    repo.countRunningAgentTurns.mockResolvedValue(4);
    await assertBelowRunningTurnCap(db, session);

    repo.getAgentQuotaConfig.mockResolvedValue(row({ maxRunningTurns: 0 }));
    repo.countRunningAgentTurns.mockResolvedValue(0);
    await expect(assertBelowRunningTurnCap(db, session)).rejects.toThrow(
      "closed"
    );
  });
});

describe("readAgentUsageStanding", () => {
  const now = new Date("2026-08-29T10:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    repo.getAgentQuotaConfig.mockResolvedValue(
      row({ resetTimeZone: "Asia/Taipei" })
    );
    repo.sumAgentUsageCost.mockResolvedValue(120_000);
    repo.countRunningAgentTurns.mockResolvedValue(1);
  });

  it("reports a limited caller's allowance, spend, week and running turns", async () => {
    const { readAgentUsageStanding } = await import("../src/quota");
    await expect(
      readAgentUsageStanding(
        db,
        { tier: CallerTier.Guest, userId: "guest-1" },
        now
      )
    ).resolves.toEqual({
      exempt: false,
      limitMicros: 300_000,
      usedMicros: 120_000,
      period: {
        start: "2026-08-23T16:00:00.000Z",
        end: "2026-08-30T16:00:00.000Z",
      },
      timeZone: "Asia/Taipei",
      runningTurns: 1,
      maxRunningTurns: 3,
    });
    expect(repo.lockAgentUser).not.toHaveBeenCalled();
  });

  it("reports the operator's spend with no limits beside it", async () => {
    const { readAgentUsageStanding } = await import("../src/quota");
    await expect(
      readAgentUsageStanding(
        db,
        { tier: CallerTier.Root, userId: "admin" },
        now
      )
    ).resolves.toMatchObject({
      exempt: true,
      limitMicros: null,
      usedMicros: 120_000,
      maxRunningTurns: null,
      runningTurns: 1,
    });
  });
});
