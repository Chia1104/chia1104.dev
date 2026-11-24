import { runPolicy } from "@chia/service-kit/adapters/orpc";
import { adminPolicy } from "@chia/service-kit/policies/admin.policy";

import { baseOS } from "../context";

/** Requires the configured admin's session. */
export const adminGuard = () =>
  baseOS
    .errors({
      UNAUTHORIZED: {},
      FORBIDDEN: {},
    })
    .middleware(async ({ next, context }) =>
      next({ context: await runPolicy(adminPolicy(), context) })
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
