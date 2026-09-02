import { getUserDetail, listUsers } from "@chia/db/repos/users";

import { adminGuard } from "../guards/admin.guard";
import { contractOS } from "../utils";

/** Reads only. Bans, session revocation, impersonation and deletion go through better-auth's admin endpoints. */

export const listUsersRoute = contractOS.user.list
  .use(adminGuard())
  .handler(async (opts) => await listUsers(opts.context.db, opts.input));

export const getUserRoute = contractOS.user.get
  .use(adminGuard())
  .handler(async (opts) => {
    const detail = await getUserDetail(opts.context.db, opts.input);
    if (!detail) {
      throw opts.errors.NOT_FOUND();
    }
    return detail;
  });
