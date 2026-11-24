import {
  banUser,
  deleteUserSessions,
  removeUser,
  unbanUser,
  updateUserProfile,
} from "@chia/db/repos/auth";
import { getUserDetail, listUsers } from "@chia/db/repos/users";

import { contractOS } from "../shared/context";
import { adminGuard } from "../shared/guards/admin.guard";
import { authGuard } from "../shared/guards/auth.guard";

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

/** The operator cannot ban, sign out or delete themselves from the dashboard. */
export const banUserRoute = contractOS.user.ban
  .use(adminGuard())
  .handler(async (opts) => {
    if (opts.input.id === opts.context.adminId) throw opts.errors.BAD_REQUEST();
    const found = await banUser(opts.context.db, {
      id: opts.input.id,
      reason: opts.input.reason || null,
      expiresAt: opts.input.expiresIn
        ? new Date(Date.now() + opts.input.expiresIn * 1000)
        : null,
    });
    if (!found) throw opts.errors.NOT_FOUND();
  });

export const unbanUserRoute = contractOS.user.unban
  .use(adminGuard())
  .handler(async (opts) => {
    if (!(await unbanUser(opts.context.db, opts.input.id))) {
      throw opts.errors.NOT_FOUND();
    }
  });

export const revokeUserSessionsRoute = contractOS.user.revokeSessions
  .use(adminGuard())
  .handler(async (opts) => {
    if (opts.input.id === opts.context.adminId) throw opts.errors.BAD_REQUEST();
    if (!(await deleteUserSessions(opts.context.db, opts.input.id))) {
      throw opts.errors.NOT_FOUND();
    }
  });

export const removeUserRoute = contractOS.user.remove
  .use(adminGuard())
  .handler(async (opts) => {
    if (opts.input.id === opts.context.adminId) throw opts.errors.BAD_REQUEST();
    if (!(await removeUser(opts.context.db, opts.input.id))) {
      throw opts.errors.NOT_FOUND();
    }
  });

export const updateProfileRoute = contractOS.user.updateProfile
  .use(authGuard)
  .handler(async (opts) => {
    const updated = await updateUserProfile(opts.context.db, {
      id: opts.context.session.user.id,
      name: opts.input.name,
      image: opts.input.image,
    });
    if (!updated) throw opts.errors.NOT_FOUND();
  });

export const userRouter = contractOS.user.router({
  list: listUsersRoute,
  get: getUserRoute,
  ban: banUserRoute,
  unban: unbanUserRoute,
  revokeSessions: revokeUserSessionsRoute,
  remove: removeUserRoute,
  updateProfile: updateProfileRoute,
});
