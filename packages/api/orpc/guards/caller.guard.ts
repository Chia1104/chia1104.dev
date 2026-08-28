import { os } from "@orpc/server";

import { runPolicy } from "@chia/service-kit/adapters/orpc";
import type {
  Caller,
  CallerPolicyOptions,
} from "@chia/service-kit/policies/caller.policy";
import {
  CallerTier,
  callerPolicy,
} from "@chia/service-kit/policies/caller.policy";
import { rateLimitPolicy } from "@chia/service-kit/policies/rate-limit.policy";

import type { BaseOSContext } from "../utils";
import { baseOS } from "../utils";

export type CallerContext = BaseOSContext & { caller: Caller };

const callerOS = os.$context<CallerContext>();

/**
 * Resolves the caller's tier onto the context, optionally requiring a minimum.
 *
 * Replaces `authGuard` / `adminGuard()` / `apiKeyGuard()` on every procedure that serves
 * more than one audience: instead of one procedure per credential, the procedure widens
 * what it returns as `context.caller.tier` rises. Procedures with a single audience keep
 * using the narrower guards.
 */
export const callerGuard = (options: CallerPolicyOptions = {}) =>
  baseOS
    .errors({
      UNAUTHORIZED: {},
      FORBIDDEN: {},
      NOT_FOUND: {},
      TOO_MANY_REQUESTS: {},
    })
    .middleware(async ({ next, context }) =>
      next({
        context: await runPolicy(
          callerPolicy({
            minTier: options.minTier,
            permissions: options.permissions,
            projectId: options.projectId ?? context.config.projectId,
          }),
          context
        ),
      })
    );

/**
 * How far each tier's budget is stretched past the anonymous one.
 *
 * Multipliers rather than four configured budgets: the deployment only ever tunes one
 * number (`RATELIMIT_MAX`), and the *relative* trust between tiers is a property of the
 * architecture, not of the environment.
 */
const TIER_MULTIPLIER = {
  [CallerTier.Anonymous]: 1,
  /** Counted per guest user rather than per address, so a little more than anonymous. */
  [CallerTier.Guest]: 2,
  [CallerTier.ApiKey]: 10,
  [CallerTier.Session]: 10,
  [CallerTier.Root]: 100,
} satisfies Record<CallerTier, number>;

/**
 * Identity the budget is counted against.
 *
 * An authenticated caller is counted per principal, not per address, so the operator is
 * not throttled by whatever else shares their egress IP.
 */
const callerKey = (caller: Caller, clientIP: string): string => {
  if (caller.session) return `user-${caller.session.user.id}`;
  if (caller.apiKey) return `key-${caller.apiKey.id}`;
  return `ip-${clientIP}`;
};

/**
 * Per-procedure rate limiting whose budget scales with the caller's tier.
 *
 * Must be chained **after** {@link callerGuard}, whose context it reads. The coarse
 * IP-keyed limit on the `/rpc` and REST mounts still runs first, so an unauthenticated
 * flood is bounded before it reaches tier resolution.
 */
export const tieredRateLimitGuard = (options: {
  prefix: string;
  windowMs?: number;
  /** Anonymous budget; every other tier is a multiple of it. */
  limit?: number;
}) =>
  callerOS
    .errors({
      TOO_MANY_REQUESTS: {},
    })
    .middleware(async ({ next, context }) => {
      const defaults = context.config.rateLimit;
      const base = options.limit ?? defaults.limit;

      await runPolicy(
        rateLimitPolicy({
          prefix: options.prefix,
          windowMs: options.windowMs ?? defaults.windowMs,
          limit: Math.ceil(base * TIER_MULTIPLIER[context.caller.tier]),
          keyGenerator: ({ clientIP }) => callerKey(context.caller, clientIP),
        }),
        context
      );

      return next();
    });
