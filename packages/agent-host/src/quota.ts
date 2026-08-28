import { AGENT_PROVIDERS } from "@chia/agent-runtime/models";
import type { DB } from "@chia/db/client";
import { countRunningAgentTurns, lockAgentUser } from "@chia/db/repos/agent";
import { getAgentQuotaConfig } from "@chia/db/repos/agent/config";
import { sumAgentUsageCost } from "@chia/db/repos/agent/usage";
import type { AgentQuotaConfig } from "@chia/db/schema";
import { AppError } from "@chia/service-kit/errors";
import { CallerTier } from "@chia/service-kit/policies/caller.policy";

import { AGENT_TURN_KEY } from "./execution";
import { costToMicros, microsToUsd } from "./usage";

/**
 * The usage quota: how much house spend a caller below `Root` may run up per week.
 *
 * Read side of the ledger. The policy is a property of the caller's tier — `Root` is the
 * operator and pays the bill, everyone else draws on one shared allowance — and the numbers
 * are the operator's `agent.quota_config` row over the code defaults, so the allowance and
 * its week can change from the dashboard without a deploy. Only house-paid calls count: a
 * BYOK call is recorded in the ledger but is the user's own bill.
 */

export interface AgentQuota {
  /** Per week, in the ledger's micro-dollars. `0` closes the agent to every limited tier. */
  weeklyLimitMicros: number;
  /** IANA zone the week is counted in; it turns over on Monday 00:00 there. */
  resetTimeZone: string;
  /**
   * Turns one user may have executing at once, across all their sessions. Bounds what one
   * visitor can put on the single-replica runner regardless of how much allowance remains.
   * `0` closes new turns to every limited tier.
   */
  maxRunningTurns: number;
}

export const systemTimeZone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Whether the runtime's zone data knows `timeZone`; aliases such as `Asia/Taipei` included. */
export const isTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
};

export const AGENT_QUOTA_DEFAULTS: AgentQuota = {
  weeklyLimitMicros: costToMicros(0.3),
  resetTimeZone: systemTimeZone(),
  maxRunningTurns: 3,
};

/** The bills a quota counts: the house gateway's only. */
export const QUOTA_PROVIDER_IDS: readonly string[] = [AGENT_PROVIDERS.gateway];

/** Tiers the quota never applies to. */
export const isQuotaExempt = (tier: CallerTier): boolean =>
  tier >= CallerTier.Root;

/**
 * The row over the defaults. A zone the runtime no longer knows falls back to the default
 * rather than failing every turn on a stale row.
 */
export const effectiveAgentQuota = (
  row:
    | Pick<
        AgentQuotaConfig,
        "weeklyLimitMicros" | "resetTimeZone" | "maxRunningTurns"
      >
    | undefined
): AgentQuota => ({
  weeklyLimitMicros:
    row?.weeklyLimitMicros ?? AGENT_QUOTA_DEFAULTS.weeklyLimitMicros,
  resetTimeZone:
    row?.resetTimeZone && isTimeZone(row.resetTimeZone)
      ? row.resetTimeZone
      : AGENT_QUOTA_DEFAULTS.resetTimeZone,
  maxRunningTurns: row?.maxRunningTurns ?? AGENT_QUOTA_DEFAULTS.maxRunningTurns,
});

export const loadAgentQuota = async (db: DB): Promise<AgentQuota> =>
  effectiveAgentQuota(await getAgentQuotaConfig(db));

// ============================================
// The week
// ============================================

export interface UsagePeriod {
  /** Inclusive. */
  start: Date;
  /** Exclusive; when the allowance is whole again. */
  end: Date;
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday, as `Date#getDay`. */
  weekday: number;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The wall clock at `instant` in `timeZone`. */
const wallClockOf = (instant: Date, timeZone: string): WallClock => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    hour: Number(value("hour")),
    minute: Number(value("minute")),
    second: Number(value("second")),
    weekday: WEEKDAYS.indexOf(value("weekday")),
  };
};

const asUtc = (clock: Omit<WallClock, "weekday">): number =>
  Date.UTC(
    clock.year,
    clock.month - 1,
    clock.day,
    clock.hour,
    clock.minute,
    clock.second
  );

/**
 * The instant at which `timeZone` reads midnight on the given calendar day.
 *
 * Starts from that wall clock read as UTC and corrects by the offset observed there; a second
 * pass settles a guess that landed across a DST transition. A midnight that does not exist
 * (spring forward at 00:00) resolves to the instant the clock reaches on the far side.
 */
const midnightAt = (
  date: Pick<WallClock, "year" | "month" | "day">,
  timeZone: string
): Date => {
  const wanted = asUtc({ ...date, hour: 0, minute: 0, second: 0 });
  let guess = wanted;
  for (let pass = 0; pass < 2; pass += 1) {
    guess += wanted - asUtc(wallClockOf(new Date(guess), timeZone));
  }
  return new Date(guess);
};

/** `days` after a calendar day, in calendar terms. */
const shiftDay = (
  date: Pick<WallClock, "year" | "month" | "day">,
  days: number
): Pick<WallClock, "year" | "month" | "day"> => {
  const shifted = new Date(
    Date.UTC(date.year, date.month - 1, date.day + days)
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
};

/** The week `now` falls in: Monday 00:00 in `timeZone` to the next. */
export const weekPeriod = (now: Date, timeZone: string): UsagePeriod => {
  const clock = wallClockOf(now, timeZone);
  const sinceMonday = (clock.weekday + 6) % 7;
  const monday = shiftDay(clock, -sinceMonday);
  return {
    start: midnightAt(monday, timeZone),
    end: midnightAt(shiftDay(monday, 7), timeZone),
  };
};

// ============================================
// The check
// ============================================

export interface AgentQuotaStanding {
  quota: AgentQuota;
  period: UsagePeriod;
  /** House spend so far this period, micro-dollars. */
  usedMicros: number;
}

/** Where `userId` stands against the quota right now. */
export const readAgentQuotaStanding = async (
  db: DB,
  userId: string,
  now = new Date()
): Promise<AgentQuotaStanding> => {
  const quota = await loadAgentQuota(db);
  const period = weekPeriod(now, quota.resetTimeZone);
  const usedMicros = await sumAgentUsageCost(db, {
    userId,
    from: period.start,
    to: period.end,
    providerIds: QUOTA_PROVIDER_IDS,
  });
  return { quota, period, usedMicros };
};

/** What `agent.usage.me` returns; mirrors the contract's `agentUsageStandingSchema`. */
export interface AgentUsageStanding {
  exempt: boolean;
  limitMicros: number | null;
  usedMicros: number;
  period: { start: string; end: string };
  timeZone: string;
  runningTurns: number;
  maxRunningTurns: number | null;
}

/**
 * The caller's standing as a client shows it. Read for everyone, exempt or not — the operator
 * sees their own spend and running turns too, with no limits beside them.
 */
export const readAgentUsageStanding = async (
  db: DB,
  caller: { tier: CallerTier; userId: string },
  now = new Date()
): Promise<AgentUsageStanding> => {
  const exempt = isQuotaExempt(caller.tier);
  const [standing, runningTurns] = await Promise.all([
    readAgentQuotaStanding(db, caller.userId, now),
    countRunningAgentTurns(db, {
      userId: caller.userId,
      turnKey: AGENT_TURN_KEY,
    }),
  ]);
  return {
    exempt,
    limitMicros: exempt ? null : standing.quota.weeklyLimitMicros,
    usedMicros: standing.usedMicros,
    period: {
      start: standing.period.start.toISOString(),
      end: standing.period.end.toISOString(),
    },
    timeZone: standing.quota.resetTimeZone,
    runningTurns,
    maxRunningTurns: exempt ? null : standing.quota.maxRunningTurns,
  };
};

const formatReset = (period: UsagePeriod, timeZone: string): string =>
  new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(period.end);

/**
 * Refuses a model call for a caller whose week is spent.
 *
 * A soft limit: the call is allowed while anything remains, so the last one may overrun by
 * at most one turn — which the kind's turn budget bounds. Checked where the call is accepted
 * (prompt, approval decision, compaction, branch summary), never mid-turn.
 */
export const assertWithinAgentQuota = async (
  db: DB,
  caller: { tier: CallerTier; userId: string },
  now = new Date()
): Promise<void> => {
  if (isQuotaExempt(caller.tier)) return;
  const standing = await readAgentQuotaStanding(db, caller.userId, now);
  if (standing.usedMicros < standing.quota.weeklyLimitMicros) return;
  const timeZone = standing.quota.resetTimeZone;
  throw new AppError("QUOTA_EXCEEDED", {
    message: `Weekly usage limit of $${microsToUsd(standing.quota.weeklyLimitMicros)} reached. It resets ${formatReset(standing.period, timeZone)} (${timeZone}).`,
    data: {
      limitMicros: standing.quota.weeklyLimitMicros,
      usedMicros: standing.usedMicros,
      resetAt: standing.period.end.toISOString(),
      timeZone,
    },
  });
};

/**
 * Refuses a new turn for a caller who already has `maxRunningTurns` executing.
 *
 * Counted under the caller's own advisory lock, taken on the transaction the turn is accepted
 * in — the session lock's — so two prompts on two sessions cannot both pass on the same count:
 * the second waits, and reads the marker the first wrote when its transaction committed. A
 * message queued behind a turn already running on its session adds no running turn and is not
 * refused. Must run inside `withAgentSessionLock`.
 */
export const assertBelowRunningTurnCap = async (
  tx: DB,
  caller: { tier: CallerTier; userId: string }
): Promise<void> => {
  if (isQuotaExempt(caller.tier)) return;
  const quota = await loadAgentQuota(tx);
  await lockAgentUser(tx, caller.userId);
  const running = await countRunningAgentTurns(tx, {
    userId: caller.userId,
    turnKey: AGENT_TURN_KEY,
  });
  if (running < quota.maxRunningTurns) return;
  throw new AppError("TOO_MANY_REQUESTS", {
    message:
      quota.maxRunningTurns === 0
        ? "New turns are closed right now."
        : `You already have ${running} turn${running === 1 ? "" : "s"} running. Wait for one to finish before starting another.`,
    data: { runningTurns: running, maxRunningTurns: quota.maxRunningTurns },
  });
};
