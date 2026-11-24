import { createFactory } from "hono/factory";

import { connectDatabase } from "@chia/db/client";
import { reportError } from "@chia/observability/report";
import { tryCatch } from "@chia/utils/error-helper";
import { errorGenerator, getClientIP } from "@chia/utils/server";

import type { ServiceHonoEnv } from "./hono";

/** Attaches db and kv to every request. */
export const createServiceFactory = () =>
  createFactory<ServiceHonoEnv>({
    initApp: (app) => {
      app.use(async (c, next) => {
        const [{ data: db, error: dbError }, { data: kv, error: kvError }] =
          await Promise.all([
            tryCatch(connectDatabase()),
            tryCatch(import("@chia/kv/redis").then((m) => m.getRedisKv())),
          ]);

        if (dbError || kvError) {
          if (dbError) reportError(dbError, "Database unavailable");
          if (kvError) reportError(kvError, "KV store unavailable");
          return c.json(errorGenerator(503), 503, {
            "Retry-After": "30",
          });
        }

        c.set("headers", c.req.raw.headers);
        c.set("clientIP", getClientIP(c.req.raw));
        c.set("db", db);
        c.set("kv", kv);

        await next();
      });
    },
  });
