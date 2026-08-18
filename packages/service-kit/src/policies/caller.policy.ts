import type { Session } from "@chia/auth/types";
import { X_CH_API_KEY } from "@chia/auth/utils";
import type { ApiKey } from "@chia/db/schema";
import { Role } from "@chia/db/types";
import { getAdminId } from "@chia/utils/config";

import { AppError } from "../errors";

import { apiKeyPolicy } from "./apikey.policy";
import { sessionPolicy } from "./session.policy";
import type { Policy } from "./types";
import { allow, deny } from "./types";

/**
 * How much the caller has proven about itself, ordered so tiers can be compared.
 *
 * Unlike every other policy in this directory — which answer a yes/no question — this
 * scale exists so one procedure can serve every audience of a resource and widen what it
 * returns as the caller proves more. The alternative, which this replaces, was a separate
 * procedure per audience reading the same table.
 */
export const CallerTier = {
  Anonymous: 0,
  /** Holds a valid `X-CH-API-KEY` for the configured project — a trusted deployment. */
  ApiKey: 1,
  /** Holds a valid session cookie. */
  Session: 2,
  /** Session belonging to the single configured admin — what `adminPolicy()` required. */
  Root: 3,
} as const;

export type CallerTier = (typeof CallerTier)[keyof typeof CallerTier];

export interface Caller {
  tier: CallerTier;
  adminId: string;
  session?: Session;
  apiKey?: Omit<ApiKey, "key">;
}

export interface CallerPolicyOptions {
  /**
   * Reject anything below this tier. Left at `Anonymous`, the policy never denies and
   * only reports what it found.
   */
  minTier?: CallerTier;
  /** Project the `X-CH-API-KEY` must belong to. */
  projectId?: number;
  permissions?: Record<string, string[]>;
}

/** Both spellings of the better-auth session cookie (`__Secure-` prefixed under TLS). */
const SESSION_COOKIE_MARKER = "session_token";

/**
 * Whether it is worth asking better-auth for a session.
 *
 * Public procedures are reachable by browsers carrying unrelated cookies, and this policy
 * runs on every one of them; without this check each anonymous page view would pay a
 * session lookup to learn nothing.
 */
const hasSessionCredential = (headers: Headers, preset?: Session | null) =>
  preset !== undefined ||
  (headers.get("Cookie")?.includes(SESSION_COOKIE_MARKER) ?? false);

const tierForSession = (session: Session, adminId: string): CallerTier =>
  session.user.id === adminId &&
  (session.user.role === Role.Root || session.user.role === Role.Admin)
    ? CallerTier.Root
    : CallerTier.Session;

/**
 * Resolves the caller's tier without deciding what it may see — that is the caller's job,
 * because "more data" means something different per resource.
 *
 * Credentials are evaluated independently and the highest tier wins, so an admin browsing
 * dash is not demoted by a stray API key header.
 */
export const callerPolicy = (
  options: CallerPolicyOptions = {}
): Policy<{ caller: Caller }> => {
  const { minTier = CallerTier.Anonymous } = options;

  return async (context) => {
    const adminId = getAdminId();
    const caller: Caller = { tier: CallerTier.Anonymous, adminId };

    if (context.headers.get(X_CH_API_KEY)) {
      /**
       * A present-but-invalid key is a hard failure rather than a silent demotion to
       * anonymous: only a misconfigured deployment sends one, and degrading it would turn
       * a rotated secret into a subtly wrong response instead of an error.
       */
      const result = await apiKeyPolicy({
        permissions: options.permissions,
        projectId: options.projectId,
      })(context);

      if (!result.ok) {
        return result;
      }

      caller.apiKey = result.patch?.apiKey;
      caller.tier = CallerTier.ApiKey;
    }

    if (hasSessionCredential(context.headers, context.session)) {
      const result = await sessionPolicy()(context);

      // An expired or absent cookie is an ordinary visitor, not an error.
      if (result.ok && result.patch) {
        caller.session = result.patch.session;
        caller.tier =
          /* SAFETY: The producer contract guarantees this value satisfies CallerTier. */ Math.max(
            caller.tier,
            tierForSession(result.patch.session, adminId)
          ) as CallerTier;
      }
    }

    if (caller.tier < minTier) {
      return deny(
        new AppError(
          caller.tier === CallerTier.Anonymous ? "UNAUTHORIZED" : "FORBIDDEN"
        )
      );
    }

    return allow({ caller });
  };
};
