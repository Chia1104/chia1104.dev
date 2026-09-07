import { os } from "@orpc/server";

import { runPolicy } from "@chia/service-kit/adapters/orpc";
import type {
  Caller,
  CallerPolicyOptions,
} from "@chia/service-kit/policies/caller.policy";
import { callerPolicy } from "@chia/service-kit/policies/caller.policy";

import type { BaseOSContext } from "../utils";
import { baseOS } from "../utils";

export type CallerContext = BaseOSContext & { caller: Caller };

/** Builder for guards that must run after {@link callerGuard}. */
export const callerOS = os.$context<CallerContext>();

/**
 * Resolves the caller's tier onto the context, optionally requiring a minimum.
 * Multi-audience procedures widen what they return as `context.caller.tier` rises.
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
            scopes: options.scopes,
          }),
          context
        ),
      })
    );
