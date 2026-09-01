import type { Context, Env } from "hono";
import { createMiddleware } from "hono/factory";
import type { ContentfulStatusCode } from "hono/utils/http-status";

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
export const applyPolicy = async <TEnv extends Env, TPatch extends object>(
  c: Context<TEnv>,
  policy: Policy<TPatch, ServiceContext>
): Promise<Response | undefined> => {
  // Context is invariant in TEnv; every service env's Variables is a superset of ServiceContext.
  // @ts-expect-error The runtime Variables contract is a superset of ServiceContext.
  const serviceContext: ServiceContext = c.var;
  const result = await policy(serviceContext);

  if (!result.ok) {
    return c.json(
      toErrorResponse(result.error),
      /* SAFETY: The producer contract guarantees this value satisfies ContentfulStatusCode. */ result
        .error.status as ContentfulStatusCode,
      result.error.headers ?? {}
    );
  }

  const mutable: MutableContext = c;

  if (result.patch) {
    for (const [key, value] of Object.entries(result.patch)) {
      mutable.set(key, value);
    }
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
