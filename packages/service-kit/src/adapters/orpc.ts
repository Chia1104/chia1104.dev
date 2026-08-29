import { ORPCError } from "@orpc/server";

import type { ServiceContext } from "../context";
import type { AppError } from "../errors";
import { isAppError } from "../errors";
import type { Policy } from "../policies/types";

/**
 * Renders an {@link AppError} as an `ORPCError`.
 *
 * The `AppError` code doubles as the oRPC error code — that is why the keys of
 * `APP_ERROR_STATUS` mirror oRPC's common codes — and the issues travel in `data` so a
 * client sees the same `errors` array the REST body carries.
 */
export const toORPCError = (error: AppError): ORPCError<string, unknown> =>
  new ORPCError(error.code, {
    status: error.status,
    message: error.message,
    data:
      error.issues || error.data
        ? { ...error.data, ...(error.issues && { errors: error.issues }) }
        : undefined,
  });

/**
 * Runs a handler body and re-throws any {@link AppError} it raises as the `ORPCError` the
 * contract declares; every other error passes through untouched. For handlers that call domain
 * code — services, ports, shared write logic — which throws `AppError` and knows nothing of oRPC.
 *
 * @example
 * .handler((opts) => withORPCErrors(() => service.compact(caller, opts.input)))
 */
export const withORPCErrors = async <T>(run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    throw isAppError(error) ? toORPCError(error) : error;
  }
};

/**
 * Runs a {@link Policy} inside an oRPC middleware and returns its patch, throwing an
 * `ORPCError` on denial.
 *
 * Deliberately not a generic `toORPCMiddleware(policy)` wrapper: oRPC types a
 * middleware's output context against the input context, which a generic patch type
 * cannot satisfy. Each guard therefore stays a few lines of binding around the shared
 * policy — the logic still exists exactly once.
 *
 * @example
 * export const authGuard = baseOS
 *   .errors({ UNAUTHORIZED: {} })
 *   .middleware(async ({ next, context }) =>
 *     next({ context: await runPolicy(sessionPolicy(), context) })
 *   );
 */
export const runPolicy = async <TPatch extends object>(
  policy: Policy<TPatch, ServiceContext>,
  context: ServiceContext
): Promise<TPatch> => {
  const result = await policy(context);

  if (!result.ok) {
    throw toORPCError(result.error);
  }

  return /* SAFETY: The producer contract guarantees this value satisfies TPatch. */ (result.patch ??
    {}) as TPatch;
};
