import { getRuntimeKey } from "hono/adapter";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

import { errorGenerator } from "@chia/utils";

import { env } from "@/env";

export const MAINTENANCE_MODE = "MAINTENANCE_MODE";
export const MAINTENANCE_BYPASS_TOKEN = "MAINTENANCE_BYPASS_TOKEN";

export const IS_MAINTENANCE_MODE =
  env.MAINTENANCE_MODE === "true" || env.MAINTENANCE_MODE === "1";

export interface MaintenanceOptions {
  /**
   * 是否啟用維護模式
   * @default false
   */
  enabled?: boolean;
  /**
   * 允許訪問的路徑
   * @default ["/api/v1/health"]
   */
  allowedPaths?: string[];
  /**
   * 維護模式的 bypass token
   */
  bypassToken?: string;
}

export const maintenance = (options?: MaintenanceOptions) =>
  createMiddleware<HonoContext>(async (c, next) => {
    if (getRuntimeKey() === "bun") {
      Bun.gc(true);
    }

    const enabled = options?.enabled ?? env.MAINTENANCE_MODE === "true";
    if (!enabled) {
      return next();
    }

    const allowedPaths = options?.allowedPaths ?? ["/api/v1/health"];
    if (allowedPaths.includes(c.req.path)) {
      return next();
    }

    try {
      // 檢查 bypass token
      const bypassToken =
        c.req.raw.headers.get(MAINTENANCE_BYPASS_TOKEN) ??
        getCookie(c, MAINTENANCE_BYPASS_TOKEN)?.toString();

      if (bypassToken && bypassToken === options?.bypassToken) {
        return next();
      }

      return c.json(
        errorGenerator(503, [
          {
            field: MAINTENANCE_MODE,
            message: "System is under maintenance",
          },
        ]),
        503,
        {
          "Retry-After": "3600",
        }
      );
    } catch (error) {
      console.error(error);
      return c.json(errorGenerator(503), 503, {
        "Retry-After": "3600",
      });
    }
  });
