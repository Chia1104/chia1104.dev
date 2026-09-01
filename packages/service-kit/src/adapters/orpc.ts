import { ORPCError } from "@orpc/server";

import type { ServiceContext } from "../context";
import type { AppError } from "../errors";
import { isAppError } from "../errors";
import type { Policy } from "../policies/types";

/** Renders an {@link AppError} as an `ORPCError`. Issues travel in `data.errors`. */
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
 * Re-throws {@link AppError} as the declared `ORPCError`; other errors pass through.
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
 * Runs a {@link Policy} in oRPC middleware and returns its patch, throwing on denial.
 *
 * Not a generic `toORPCMiddleware`: oRPC types output context against input, which a
 * generic patch type cannot satisfy. Each guard binds the shared policy in a few lines.
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
