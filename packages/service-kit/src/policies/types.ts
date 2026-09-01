import type { ServiceContext } from "../context";
import type { AppError } from "../errors";

/**
 * Policy check result. `patch` is merged into request context; `headers` are applied
 * whether the policy passes or denies.
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
 * Authorization check over {@link ServiceContext} only — never a Request — so one
 * function backs both Hono and oRPC.
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
