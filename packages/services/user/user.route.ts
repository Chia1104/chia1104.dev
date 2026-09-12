import { getUserDetail, listUsers } from "@chia/db/repos/users";

import { contractOS } from "../shared/context";
import { adminGuard } from "../shared/guards/admin.guard";

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

export const userRouter = contractOS.user.router({
  list: listUsersRoute,
  get: getUserRoute,
});
