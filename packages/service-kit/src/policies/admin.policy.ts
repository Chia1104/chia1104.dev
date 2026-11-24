import type { SessionRecord } from "@chia/db/repos/auth";
import { getAdminId } from "@chia/utils/config";

import { AppError, AppErrorCode } from "../errors";

import { resolveSession } from "./session.policy";
import type { Policy } from "./types";
import { allow, deny } from "./types";

/** Requires the configured admin's session. */
export const adminPolicy = (): Policy<{
  session: SessionRecord;
  adminId: string;
}> => {
  return async (context) => {
    const session = await resolveSession(context);

    if (!session || session.user.isAnonymous) {
      return deny(new AppError(AppErrorCode.Unauthorized));
    }

    const adminId = getAdminId();

    if (session.user.id !== adminId) {
      return deny(new AppError(AppErrorCode.Forbidden));
    }

    return allow({ session, adminId });
  };
};
