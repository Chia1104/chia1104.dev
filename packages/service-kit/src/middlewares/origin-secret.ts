import { createMiddleware } from "hono/factory";

import { isOriginRequestAllowed } from "@chia/utils/server/origin";

import { AppError, AppErrorCode } from "../errors";
import type { ServiceHonoEnv } from "../hono";

/** Refuses a request that reached the origin through Railway's edge without passing Cloudflare. */
export const originSecret = (secret: string | undefined) =>
  createMiddleware<ServiceHonoEnv>(async (c, next) => {
    if (!isOriginRequestAllowed(c.req.raw.headers, secret)) {
      throw new AppError(AppErrorCode.Forbidden);
    }
    return next();
  });
