import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { env as spotifyEnv } from "@chia/api/spotify/env";
import { env as authEnv } from "@chia/auth/env";
import { numericStringSchema } from "@chia/utils";

export const env = createEnv({
  server: {
    PORT: z.number().optional().default(3005),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .optional()
      .default("development"),
    REDIS_URL: z.string().optional(),
    REDIS_URI: z.string().optional(),
    CORS_ALLOWED_ORIGIN: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    SENTRY_DSN: z.string().optional(),
    ZEABUR_SERVICE_ID: z.string().optional(),
    RATELIMIT_WINDOW_MS: z
      .number()
      .optional()
      .default(15 * 60000),
    RATELIMIT_MAX: z.number().optional().default(87),
    OPENAI_API_KEY: z.string().optional(),
    AI_AUTH_SECRET: z.string().optional(),
    IP_DENY_LIST: z.string().optional(),
    IP_ALLOW_LIST: z.string().optional(),
    MAINTENANCE_MODE: z.string().optional().default("false"),
    MAINTENANCE_BYPASS_TOKEN: z.string().optional(),
    TIMEOUT_MS: numericStringSchema,
  },
  runtimeEnv: {
    PORT: process.env.PORT ? Number(process.env.PORT) : 3005,
    NODE_ENV: process.env.NODE_ENV ?? "development",
    REDIS_URL: process.env.REDIS_URL,
    REDIS_URI: process.env.REDIS_URI,
    CORS_ALLOWED_ORIGIN: process.env.CORS_ALLOWED_ORIGIN,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    SENTRY_DSN: process.env.SENTRY_DSN,
    ZEABUR_SERVICE_ID: process.env.ZEABUR_SERVICE_ID,
    RATELIMIT_WINDOW_MS: process.env.RATELIMIT_WINDOW_MS
      ? Number(process.env.RATELIMIT_WINDOW_MS)
      : 15 * 60000,
    RATELIMIT_MAX: process.env.RATELIMIT_MAX
      ? Number(process.env.RATELIMIT_MAX)
      : 87,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AI_AUTH_SECRET: process.env.AI_AUTH_SECRET,
    IP_DENY_LIST: process.env.IP_DENY_LIST,
    IP_ALLOW_LIST: process.env.IP_ALLOW_LIST,
    MAINTENANCE_MODE:
      process.env.MAINTENANCE_MODE === "true" ||
      process.env.MAINTENANCE_MODE === "1"
        ? "true"
        : "false",
    MAINTENANCE_BYPASS_TOKEN: process.env.MAINTENANCE_BYPASS_TOKEN,
    TIMEOUT_MS: process.env.TIMEOUT_MS || "10000",
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
  extends: [spotifyEnv, authEnv],
});

export type ENV = typeof env;
