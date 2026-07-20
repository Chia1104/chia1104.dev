import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

import { env as authEnv } from "@chia/auth/env";
import { env as dbEnv } from "@chia/db/env";
import { env as kvEnv } from "@chia/kv/env";
import { NumericStringSchema } from "@chia/utils/schema";

export const env = createEnv({
  server: {
    PORT: z.number().optional().default(3006),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .optional()
      .default("development"),
    CORS_ALLOWED_ORIGIN: z.string().optional(),
    SENTRY_DSN: z.string().optional(),
    ZEABUR_SERVICE_ID: z.string().optional(),
    TIMEOUT_MS: NumericStringSchema,
    INTERNAL_AUTH_SERVICE_TOKEN: z.string().optional(),
  },
  runtimeEnv: {
    PORT: process.env.PORT ? Number(process.env.PORT) : 3006,
    NODE_ENV: process.env.NODE_ENV ?? "development",
    CORS_ALLOWED_ORIGIN: process.env.CORS_ALLOWED_ORIGIN,
    SENTRY_DSN: process.env.SENTRY_DSN,
    ZEABUR_SERVICE_ID: process.env.ZEABUR_SERVICE_ID,
    TIMEOUT_MS: process.env.TIMEOUT_MS || "10000",
    INTERNAL_AUTH_SERVICE_TOKEN: process.env.INTERNAL_AUTH_SERVICE_TOKEN,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
  extends: [authEnv, dbEnv, kvEnv],
});

export type ENV = typeof env;
