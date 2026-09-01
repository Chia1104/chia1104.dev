import type { Session } from "@chia/auth/types";
import { Role } from "@chia/db/types";
import { getAdminId } from "@chia/utils/config";

import { AppError } from "../errors";

import type { Policy } from "./types";
import { allow, deny } from "./types";

const DEFAULT_ROLES: Role[] = [Role.Admin, Role.Root];

export interface AdminPolicyOptions {
  /**
   * Accepted roles.
   * @default [Role.Admin, Role.Root]
   */
  roles?: Role[];
  /**
   * Also require the session user to be the configured admin.
   * @default true
   */
  pinToAdminId?: boolean;
}

/**
 * Requires an authenticated session in `roles`, optionally pinned to the single
 * configured admin id.
 */
export const adminPolicy = (
  options: AdminPolicyOptions = {}
): Policy<{ session: Session; adminId: string }> => {
  const { roles = DEFAULT_ROLES, pinToAdminId = true } = options;

  return async (context) => {
    const session =
      context.session ??
      (await context.auth?.api.getSession({ headers: context.headers }));

    if (!session?.session || !session.user) {
      return deny(new AppError("UNAUTHORIZED"));
    }

    const adminId = getAdminId();

    if (!roles.includes(session.user.role)) {
      return deny(new AppError("FORBIDDEN"));
    }

    if (pinToAdminId && session.user.id !== adminId) {
      return deny(new AppError("FORBIDDEN"));
    }

    return allow({ session, adminId });
  };
};
