import { runPolicy } from "@chia/service-kit/adapters/orpc";
import { apiKeyPolicy } from "@chia/service-kit/policies";

import { getORPCConfig } from "../config";
import { baseOS } from "../utils";

/**
 * Verifies the `X-CH-API-KEY` header. The project the key must belong to comes from the
 * hosting app's config (see `configureORPC`), so `@chia/api` needs no env of its own.
 */
export const apiKeyGuard = (options?: {
  permissions?: Record<string, string[]>;
  /** Overrides the app-configured project id. */
  projectId?: number;
}) =>
  baseOS
    .errors({
      UNAUTHORIZED: {},
      FORBIDDEN: {},
      NOT_FOUND: {},
      TOO_MANY_REQUESTS: {},
    })
    .middleware(async ({ next, context }) =>
      next({
        context: await runPolicy(
          apiKeyPolicy({
            permissions: options?.permissions,
            projectId: options?.projectId ?? getORPCConfig().projectId,
          }),
          context
        ),
      })
    );
