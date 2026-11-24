import { hashSessionToken, readSessionToken } from "@chia/auth/session";
import { CallerTier, tierForUser } from "@chia/auth/tier";
import type { SessionRecord } from "@chia/db/repos/auth";
import { findSession } from "@chia/db/repos/auth";
import { getAdminId } from "@chia/utils/config";

import type { ServiceContext } from "../context";
import { AppError, AppErrorCode } from "../errors";

import type { Policy } from "./types";
import { allow, deny } from "./types";

export interface SessionPolicyOptions {
  /** Also require the configured admin. */
  rootOnly?: boolean;
  /**
   * Admit a guest session. Off by default: a guest holds a session cookie, but
   * "signed in" means a person.
   */
  allowAnonymous?: boolean;
}

/** The session the request's cookie names, reusing `context.session` when already resolved. */
export const resolveSession = async (
  context: Pick<ServiceContext, "db" | "headers" | "session">
): Promise<SessionRecord | null> => {
  if (context.session !== undefined) return context.session;
  const token = readSessionToken(context.headers);
  if (!token) return null;
  return await findSession(context.db, await hashSessionToken(token));
};

/** Requires an authenticated session. */
export const sessionPolicy = (
  options: SessionPolicyOptions = {}
): Policy<{ session: SessionRecord }> => {
  return async (context) => {
    const session = await resolveSession(context);

    if (!session) {
      return deny(new AppError(AppErrorCode.Unauthorized));
    }

    // A guest is "not signed in" to everything that did not opt in.
    if (session.user.isAnonymous && !options.allowAnonymous) {
      return deny(new AppError(AppErrorCode.Unauthorized));
    }

    if (
      options.rootOnly &&
      tierForUser(session.user, getAdminId()) !== CallerTier.Root
    ) {
      return deny(new AppError(AppErrorCode.Forbidden));
    }

    return allow({ session });
  };
};
