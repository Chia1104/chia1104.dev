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
 * Runs a {@link Policy} against a live Hono context.
 *
 * Returns a `Response` when the policy denies the request, and `undefined` when it
 * passes — having written the policy's `patch` onto the context with `c.set` and its
 * `headers` onto the response.
 *
 * Use this directly when the policy's options depend on the request (e.g. the AI guard
 * reads the provider out of the JSON body); use {@link toHonoMiddleware} otherwise.
 */
export const applyPolicy = async <TEnv extends Env, TPatch extends object>(
  c: Context<TEnv>,
  policy: Policy<TPatch, ServiceContext>
): Promise<Response | undefined> => {
  // Every service app declares `Variables` as (a superset of) `ServiceContext`; Hono's
  // `Context` is invariant in its env, so the cast is what keeps this callable from a
  // route whose context has been widened by an upstream middleware.
  // Every service Hono env includes ServiceContext, but Context remains invariant in TEnv.
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

/**
 * Lifts a {@link Policy} into Hono middleware. The patch is readable downstream as
 * `c.var.<key>`.
 */
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
