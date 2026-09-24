import type { Context, Env } from "hono";
import { createMiddleware } from "hono/factory";

import type { ServiceContext } from "../context";
import { toErrorResponse } from "../errors";
import type { ServiceHonoEnv } from "../hono";
import type { Policy } from "../policies/types";

interface MutableContext {
  set: <TValue>(key: string, value: TValue) => void;
  header: (name: string, value: string) => void;
}

/**
 * Runs a {@link Policy} on a Hono context. Returns a `Response` on deny; on pass,
 * writes `patch` via `c.set` and `headers` onto the response.
 *
 * Use when policy options depend on the request; otherwise {@link toHonoMiddleware}.
 */
export const applyPolicy = async <
  TEnv extends Env,
  TPatch extends object,
  TContext extends ServiceContext = ServiceContext,
>(
  c: Context<TEnv>,
  policy: Policy<TPatch, TContext>
): Promise<Response | undefined> => {
  // Context is invariant in TEnv; every service env's Variables is a superset of ServiceContext.
  // @ts-expect-error The runtime Variables contract is a superset of TContext.
  const serviceContext: TContext = c.var;
  const result = await policy(serviceContext);

  if (!result.ok) {
    // A 5xx is this service's failure: `bootstrap()`'s error handler logs, reports and renders it.
    if (result.error.status >= 500) throw result.error;
    return c.json(
      toErrorResponse(result.error),
      result.error.status,
      result.error.headers ?? {}
    );
  }

  const mutable: MutableContext = c;

  for (const [key, value] of Object.entries(result.patch)) {
    mutable.set(key, value);
  }

  if (result.headers) {
    for (const [key, value] of Object.entries(result.headers)) {
      mutable.header(key, value);
    }
  }

  return undefined;
};

/** Hono middleware for a {@link Policy}. Patch is `c.var.<key>` downstream. */
export const toHonoMiddleware = <TPatch extends object>(
  policy: Policy<TPatch, ServiceContext>
) =>
  createMiddleware<ServiceHonoEnv<ServiceContext & TPatch>>(async (c, next) => {
    const denied = await applyPolicy(c, policy);

    if (denied) {
      return denied;
    }

    await next();
  });
