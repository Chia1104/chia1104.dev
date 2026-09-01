import { runPolicy } from "@chia/service-kit/adapters/orpc";
import { sessionPolicy } from "@chia/service-kit/policies/session.policy";

import { baseOS } from "../utils";

/** Binding around `sessionPolicy`; the Hono side uses the same policy through `toHonoMiddleware`. */
export const authGuard = baseOS
  .errors({
    UNAUTHORIZED: {},
  })
  .middleware(async ({ next, context }) =>
    next({ context: await runPolicy(sessionPolicy(), context) })
  );

export interface SessionGuardInput {
  /**
   * Escalate the requirement to `Role.Root` for *this* call. Mapped in from the
   * validated input by the procedure, since a policy never sees the request.
   */
  rootOnly?: boolean;
}

/**
 * Like {@link authGuard}, but whether root is required depends on the request input.
 * A session is required either way; `rootOnly` only raises the bar.
 *
 * @example
 * .use(sessionGuard.adaptInput((input) => ({ rootOnly: isOpenAIEmbeddingModel(input.model) })))
 */
export const sessionGuard = baseOS
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
  })
  .middleware(async ({ next, context }, input: SessionGuardInput) =>
    next({
      context: await runPolicy(
        sessionPolicy({ rootOnly: input.rootOnly }),
        context
      ),
    })
  );
