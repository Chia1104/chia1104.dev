import type { Session } from "@chia/auth/types";
import { Role } from "@chia/db/types";

import { AppError } from "../errors";

import type { Policy } from "./types";
import { allow, deny } from "./types";

export interface SessionPolicyOptions {
  /**
   * Additionally require `Role.Root`. Replaces the old `verifyAuth(rootOnly)` flag.
   */
  rootOnly?: boolean;
}

/**
 * Requires an authenticated session. Reuses `context.session` when an in-process
 * caller already resolved it, otherwise asks better-auth.
 */
export const sessionPolicy = (
  options: SessionPolicyOptions = {}
): Policy<{ session: Session }> => {
  return async (context) => {
    const session =
      context.session ??
      (await context.auth?.api.getSession({ headers: context.headers }));

    if (!session?.session || !session.user) {
      return deny(new AppError("UNAUTHORIZED"));
    }

    if (options.rootOnly && session.user.role !== Role.Root) {
      return deny(new AppError("FORBIDDEN"));
    }

    return allow({ session });
  };
};
