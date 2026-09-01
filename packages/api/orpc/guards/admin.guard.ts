import { runPolicy } from "@chia/service-kit/adapters/orpc";
import type { AdminPolicyOptions } from "@chia/service-kit/policies/admin.policy";
import { adminPolicy } from "@chia/service-kit/policies/admin.policy";

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

/** @TODO */
export const adminGuardWithAC = (_ac: string[]) =>
  baseOS
    .errors({
      NOT_IMPLEMENTED: {},
    })
    .middleware(({ errors }) => {
      throw errors.NOT_IMPLEMENTED();
    });
