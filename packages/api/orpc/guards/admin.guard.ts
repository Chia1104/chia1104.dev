import { auth } from "@chia/auth";
import { Role } from "@chia/db/types";
import { getAdminId } from "@chia/utils";

import { baseOS } from "../utils";

export const adminGuard = (role: Role[] = [Role.Admin, Role.Root]) =>
  baseOS
    .errors({
      UNAUTHORIZED: {},
      FORBIDDEN: {},
    })
    .middleware(async ({ next, context, errors }) => {
      const sessionData =
        context.session ??
        (await auth.api.getSession({
          headers: context.headers,
        }));

      if (!sessionData?.session || !sessionData?.user) {
        if (context.hooks?.onUnauthorized) {
          context.hooks.onUnauthorized(errors.UNAUTHORIZED());
        }
        throw errors.UNAUTHORIZED();
      }

      const adminId = getAdminId();

      if (
        !role?.includes(sessionData.user.role) ||
        sessionData.user.id !== adminId
      ) {
        if (context.hooks?.onForbidden) {
          context.hooks.onForbidden(errors.FORBIDDEN());
        }
        throw errors.FORBIDDEN();
      }

      return next({
        context: {
          session: sessionData,
          adminId,
        },
      });
    });

/**
 * @TODO: Implement this function.
 * @param ac - The access control list to check against.
 * @returns A middleware function that checks if the user has the required access control list.
 */
export const adminGuardWithAC = (_ac: string[]) =>
  baseOS
    .errors({
      NOT_IMPLEMENTED: {},
    })
    .middleware(({ errors }) => {
      throw errors.NOT_IMPLEMENTED();
    });
