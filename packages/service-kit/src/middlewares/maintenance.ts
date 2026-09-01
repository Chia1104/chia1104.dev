import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

import { errorGenerator } from "@chia/utils/server";

import type { ServiceHonoEnv } from "../hono";

export const MAINTENANCE_MODE = "MAINTENANCE_MODE";
export const MAINTENANCE_BYPASS_TOKEN = "MAINTENANCE_BYPASS_TOKEN";

export const isMaintenanceEnabled = (value?: string): boolean =>
  value === "true" || value === "1";

export interface MaintenanceOptions {
  /**
   * @default false
   */
  enabled?: boolean;
  /**
   * Paths that still answer during maintenance.
   * @default ["/api/v1/health"]
   */
  allowedPaths?: string[];
  /** Header/cookie that skips maintenance. */
  bypassToken?: string;
}

export const maintenance = (options?: MaintenanceOptions) =>
  createMiddleware<ServiceHonoEnv>(async (c, next) => {
    if (!options?.enabled) {
      return next();
    }

    const allowedPaths = options.allowedPaths ?? ["/api/v1/health"];
    if (allowedPaths.includes(c.req.path)) {
      return next();
    }

    try {
      const bypassToken =
        c.req.raw.headers.get(MAINTENANCE_BYPASS_TOKEN) ??
        getCookie(c, MAINTENANCE_BYPASS_TOKEN)?.toString();

      if (bypassToken && bypassToken === options.bypassToken) {
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
