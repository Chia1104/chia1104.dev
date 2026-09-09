import type { ApiKeyScope } from "@chia/auth/apikey";
import { ApiKeyScope as Scope, hasApiKeyScope } from "@chia/auth/apikey";
import { CallerTier, tierForUser } from "@chia/auth/tier";
import type { Session } from "@chia/auth/types";
import { X_CH_API_KEY } from "@chia/auth/utils";
import { getAdminId } from "@chia/utils/config";

import { AppError } from "../errors";

import type { VerifiedApiKey } from "./apikey.policy";
import { apiKeyPolicy, missingApiKeyScope } from "./apikey.policy";
import { sessionPolicy } from "./session.policy";
import type { Policy, PolicyResult } from "./types";
import { allow, deny } from "./types";

export interface Caller {
  tier: CallerTier;
  adminId: string;
  session?: Session;
  apiKey?: VerifiedApiKey;
}

export interface CallerPolicyOptions {
  /** Reject anything below this tier. At `Anonymous`, never denies. */
  minTier?: CallerTier;
  /**
   * Scopes an API key must carry to be accepted at all. A session is never scoped, and neither
   * is a key lifted to Root: acting as the operator implies every scope.
   */
  scopes?: readonly ApiKeyScope[];
}

/** Both spellings of the better-auth session cookie (`__Secure-` prefixed under TLS). */
const SESSION_COOKIE_MARKER = "session_token";

/** Skip the session lookup when there is no cookie and no preset. */
const hasSessionCredential = (headers: Headers, preset?: Session | null) =>
  preset !== undefined ||
  (headers.get("Cookie")?.includes(SESSION_COOKIE_MARKER) ?? false);

/**
 * A key that carries `operator:root` and belongs to the configured admin acts as that admin.
 * Ownership is checked here, not at key creation, so a key handed to another user cannot keep
 * the tier.
 */
const tierForApiKey = (apiKey: VerifiedApiKey, adminId: string): CallerTier =>
  apiKey.referenceId === adminId &&
  hasApiKeyScope(apiKey.permissions, Scope.OperatorRoot)
    ? CallerTier.Root
    : CallerTier.ApiKey;

/** Applies `minTier` and the key scopes to an already-graded caller. */
const admit = (
  caller: Caller,
  options: CallerPolicyOptions
): PolicyResult<{ caller: Caller; session?: Session }> => {
  const { minTier = CallerTier.Anonymous } = options;

  if (caller.apiKey && caller.tier < CallerTier.Root) {
    const missing = missingApiKeyScope(caller.apiKey, options.scopes);
    if (missing) {
      return deny(missing);
    }
  }

  if (caller.tier < minTier) {
    return deny(
      new AppError(
        caller.tier === CallerTier.Anonymous ? "UNAUTHORIZED" : "FORBIDDEN"
      )
    );
  }

  // The session rides along so `sessionPolicy` and `adminPolicy` downstream skip `getSession`.
  return allow({ caller, session: caller.session });
};

/**
 * Resolves the caller's tier. Credentials are independent and the highest wins. A caller
 * already on the context is graded, not re-verified.
 */
export const callerPolicy = (
  options: CallerPolicyOptions = {}
): Policy<{ caller: Caller; session?: Session }> => {
  return async (context) => {
    if (context.caller) {
      return admit(context.caller, options);
    }

    const adminId = getAdminId();
    const caller: Caller = { tier: CallerTier.Anonymous, adminId };

    if (context.headers.get(X_CH_API_KEY)) {
      /**
       * A present-but-invalid key is a hard failure, not a silent demotion to anonymous.
       */
      const result = await apiKeyPolicy()(context);

      if (!result.ok) {
        return result;
      }

      caller.apiKey = result.patch?.apiKey;
      caller.tier = caller.apiKey
        ? tierForApiKey(caller.apiKey, adminId)
        : CallerTier.ApiKey;
    }

    if (hasSessionCredential(context.headers, context.session)) {
      // Guests are admitted here, as their own tier; `sessionPolicy` alone still refuses them.
      const result = await sessionPolicy({ allowAnonymous: true })(context);

      // An expired or absent cookie is an ordinary visitor, not an error.
      if (result.ok && result.patch) {
        caller.session = result.patch.session;
        caller.tier =
          /* SAFETY: The producer contract guarantees this value satisfies CallerTier. */ Math.max(
            caller.tier,
            tierForUser(result.patch.session.user, adminId)
          ) as CallerTier;
      }
    }

    return admit(caller, options);
  };
};
