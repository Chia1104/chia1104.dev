import { createFactory } from "hono/factory";
import once from "lodash/once.js";

import { createAuth } from "@chia/auth";
import { createRemoteAuthGateway } from "@chia/auth/gateway";
import type { AuthGateway } from "@chia/auth/gateway";
import type { DB } from "@chia/db";
import { connectDatabase } from "@chia/db/client";
import type { Keyv } from "@chia/kv";
// read through serviceEnv, not the app env: t3-env's `extends` is skipped
// entirely when SKIP_ENV_VALIDATION is set, so extended vars vanish there
import { serviceEnv } from "@chia/utils/config/env";
import { tryCatch } from "@chia/utils/error-helper";
import { errorGenerator } from "@chia/utils/server";
import { getClientIP } from "@chia/utils/server";

import { env } from "../env";

/**
 * When INTERNAL_AUTH_SERVICE_ENDPOINT is set, auth is delegated to the
 * standalone auth service over HTTP. Otherwise fall back to an in-process
 * better-auth instance (single-service/local development).
 */
const getAuthGateway = once((db: DB, kv: Keyv): AuthGateway => {
  if (serviceEnv.INTERNAL_AUTH_SERVICE_ENDPOINT) {
    return createRemoteAuthGateway({
      baseURL: serviceEnv.INTERNAL_AUTH_SERVICE_ENDPOINT,
      internalToken: env.INTERNAL_AUTH_SERVICE_TOKEN,
    });
  }
  return createAuth(db, kv);
});

export default createFactory<HonoContext>({
  initApp: (app) => {
    app.use(async (c, next) => {
      const [{ data: db, error: dbError }, { data: kv, error: kvError }] =
        await Promise.all([
          tryCatch(connectDatabase()),
          tryCatch(import("@chia/kv").then((m) => m.kv)),
        ]);

      if (dbError || kvError) {
        console.error(dbError, kvError);
        return c.json(errorGenerator(503));
      }

      c.set("clientIP", getClientIP(c.req.raw));
      c.set("db", db);
      c.set("kv", kv);
      c.set("auth", getAuthGateway(db, kv));

      await next();
    });
  },
});
