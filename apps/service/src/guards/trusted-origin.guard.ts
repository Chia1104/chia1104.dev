import { createMiddleware } from "hono/factory";

import { isTrustedOrigin } from "@chia/auth/oauth";
import {
  AppError,
  AppErrorCode,
  toErrorResponse,
} from "@chia/service-kit/errors";

export interface TrustedOriginOptions {
  /** Also refuse a request that names no `Origin`, for routes only a browser calls. */
  requireOrigin?: boolean;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Refuses a state-changing request from an origin outside the allow-list (CSRF). A browser
 * names its origin on every such request, so one without it is a server or a CLI, which
 * carries no visitor's cookie.
 */
export const verifyTrustedOrigin = (options: TrustedOriginOptions = {}) =>
  createMiddleware<HonoContext>(async (c, next) => {
    const origin = c.req.header("Origin");
    const refused =
      !SAFE_METHODS.has(c.req.method) &&
      (origin === undefined ? options.requireOrigin : !isTrustedOrigin(origin));

    if (refused) {
      const error = new AppError(AppErrorCode.Forbidden);
      return c.json(toErrorResponse(error), error.status);
    }
    await next();
  });
