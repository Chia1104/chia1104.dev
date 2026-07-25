import type { ServiceContext } from "../context";
import type { AppError } from "../errors";

/**
 * Outcome of a policy check.
 *
 * `patch` is merged into the request context (Hono `c.set`, oRPC `next({ context })`),
 * so a policy can hand downstream handlers what it resolved — a session, an admin id,
 * a decoded token. `headers` is applied to the response either way, which is how the
 * rate limiter reports its budget on success.
 */
export type PolicyResult<TPatch extends object = Record<never, never>> =
  | {
      ok: true;
      patch?: TPatch;
      headers?: Record<string, string>;
    }
  | {
      ok: false;
      error: AppError;
    };

/**
 * A transport-agnostic authorization / admission check.
 *
 * Policies read only {@link ServiceContext} — never a `Request` — so the same function
 * backs both the Hono middleware and the oRPC middleware. Anything request-shaped
 * (query params, request body, validated input) is resolved by the caller and passed
 * in as an option instead.
 */
export type Policy<
  TPatch extends object = Record<never, never>,
  TContext extends ServiceContext = ServiceContext,
> = (context: TContext) => Promise<PolicyResult<TPatch>> | PolicyResult<TPatch>;

export const allow = <TPatch extends object>(
  patch?: TPatch,
  headers?: Record<string, string>
): PolicyResult<TPatch> => ({ ok: true, patch, headers });

export const deny = (error: AppError): PolicyResult<never> => ({
  ok: false,
  error,
});
