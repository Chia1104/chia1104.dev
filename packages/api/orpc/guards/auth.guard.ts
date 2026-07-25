import { runPolicy } from "@chia/service-kit/adapters/orpc";
import { sessionPolicy } from "@chia/service-kit/policies";

import { baseOS } from "../utils";

/**
 * Thin binding around the shared `sessionPolicy` — the Hono side uses the very same
 * policy through `toHonoMiddleware`.
 */
export const authGuard = baseOS
  .errors({
    UNAUTHORIZED: {},
  })
  .middleware(async ({ next, context }) =>
    next({ context: await runPolicy(sessionPolicy(), context) })
  );
