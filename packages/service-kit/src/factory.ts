import { createFactory } from "hono/factory";

import type { CreateAuthOptions } from "@chia/auth/server";
import { createAuth } from "@chia/auth/server";
import { connectDatabase } from "@chia/db/client";
import { reportError } from "@chia/observability/report";
import { tryCatch } from "@chia/utils/error-helper";
import { errorGenerator, getClientIP } from "@chia/utils/server";

import type { ServiceHonoEnv } from "./hono";

export interface ServiceFactoryOptions {
  auth: CreateAuthOptions;
}

/** Attaches db, kv and auth to every request. */
export const createServiceFactory = (options: ServiceFactoryOptions) =>
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
        c.set("auth", createAuth(db, kv, options.auth));

        await next();
      });
    },
  });
