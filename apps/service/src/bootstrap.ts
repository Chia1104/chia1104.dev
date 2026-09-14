import type { Hono, Schema } from "hono";

import { CallerTier } from "@chia/auth/tier";
import { bootstrap as bootstrapApp } from "@chia/service-kit/bootstrap";

import { env } from "./env";
import { getCORSAllowedOrigin } from "./utils/cors.util";
import { procedureOf } from "./utils/rpc.util";

const corsOrigin = getCORSAllowedOrigin();

const tierNames = new Map<number, string>(
  Object.entries(CallerTier).map(([name, tier]) => [tier, name])
);

const bootstrap = <
  TSchema extends Schema,
  TApp extends Hono<HonoContext, TSchema>,
>(
  app: TApp
) =>
  bootstrapApp<HonoContext, TSchema, TApp>(app, {
    cors: {
      origin: corsOrigin,
      credentials: corsOrigin !== "*",
    },
    maintenance: {
      enabled: env.MAINTENANCE_MODE === "true",
      allowedPaths: ["/api/v1/health"],
      bypassToken: env.MAINTENANCE_BYPASS_TOKEN,
    },
    // `caller` is unset on routes that never resolve one, such as health.
    requestLogFields: (c) => ({
      procedure: procedureOf(c.req.path),
      callerTier:
        c.var.caller === undefined
          ? undefined
          : tierNames.get(c.var.caller.tier),
      userId: c.var.caller?.session?.user.id,
      apiKeyId: c.var.caller?.apiKey?.id,
    }),
  });

export default bootstrap;
