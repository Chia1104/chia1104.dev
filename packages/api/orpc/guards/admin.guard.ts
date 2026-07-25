import { runPolicy } from "@chia/service-kit/adapters/orpc";
import type { AdminPolicyOptions } from "@chia/service-kit/policies";
import { adminIdPolicy, adminPolicy } from "@chia/service-kit/policies";

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
 * Performs no authorization — only exposes the configured `adminId`. For public routes
 * that read the admin's own data.
 *
 * Deliberately separate from {@link adminGuard} rather than an `enabled: false` option:
 * the previous option form ran the role check whenever a session happened to be on the
 * context, which rejected logged-in non-admin users on public routes.
 */
export const adminIdGuard = baseOS.middleware(async ({ next, context }) =>
  next({ context: await runPolicy(adminIdPolicy(), context) })
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
