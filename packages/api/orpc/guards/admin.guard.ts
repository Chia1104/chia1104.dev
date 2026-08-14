import { runPolicy } from "@chia/service-kit/adapters/orpc";
import type { AdminPolicyOptions } from "@chia/service-kit/policies";
import { adminPolicy } from "@chia/service-kit/policies";

import { baseOS } from "../utils";

/**
 * Requires an authenticated session in `roles` whose user id matches the configured
 * admin id. Pass `pinToAdminId: false` for "any admin/root" routes.
 */
export const adminGuard = (options: AdminPolicyOptions = {}) =>
  baseOS
    .errors({
      UNAUTHORIZED: {},
      FORBIDDEN: {},
    })
    .middleware(async ({ next, context }) =>
      next({ context: await runPolicy(adminPolicy(options), context) })
    );

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
