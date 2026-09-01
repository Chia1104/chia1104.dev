import type { Session } from "@chia/auth/types";
import { Role } from "@chia/db/types";

import { AppError } from "../errors";

import type { Policy } from "./types";
import { allow, deny } from "./types";

export interface SessionPolicyOptions {
  /** Also require `Role.Root`. */
  rootOnly?: boolean;
  /**
   * Admit a guest user from better-auth's `anonymous()` plugin. Off by default:
   * a guest holds a session cookie, but "signed in" means a person.
   */
  allowAnonymous?: boolean;
}

/**
 * Requires an authenticated session. Reuses `context.session` when already
 * resolved, otherwise asks better-auth.
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

    // A guest is "not signed in" to everything that did not opt in.
    if (session.user.isAnonymous === true && !options.allowAnonymous) {
      return deny(new AppError("UNAUTHORIZED"));
    }

    if (options.rootOnly && session.user.role !== Role.Root) {
      return deny(new AppError("FORBIDDEN"));
    }

    return allow({ session });
  };
};
