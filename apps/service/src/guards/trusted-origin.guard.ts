import { createMiddleware } from "hono/factory";

import { isTrustedOrigin } from "@chia/auth/oauth";
import {
  AppError,
  AppErrorCode,
  toErrorResponse,
} from "@chia/service-kit/errors";

/** Refuses a cookie-bearing POST from any origin outside the allow-list (CSRF). */
export const verifyTrustedOrigin = () =>
  createMiddleware<HonoContext>(async (c, next) => {
    if (c.req.method === "POST" && !isTrustedOrigin(c.req.header("Origin"))) {
      const error = new AppError(AppErrorCode.Forbidden);
      return c.json(toErrorResponse(error), error.status);
    }
    await next();
  });
