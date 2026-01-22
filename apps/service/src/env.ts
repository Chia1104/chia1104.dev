import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

import { env as captchaEnv } from "@chia/api/captcha/env";
import { env as s3Env } from "@chia/api/s3/env";
import { env as spotifyEnv } from "@chia/api/spotify/env";
import { env as authEnv } from "@chia/auth/env";
import { env as dbEnv } from "@chia/db/env";
import { env as kvEnv } from "@chia/kv/env";
import { serviceEnv } from "@chia/utils/config/env";
import { NumericStringSchema } from "@chia/utils/schema";

export const env = createEnv({
  server: {
    PORT: z.number().optional().default(3005),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .optional()
      .default("development"),
    CORS_ALLOWED_ORIGIN: z.string().optional(),
    RESEND_API_KEY: z.string().min(1),
    SENTRY_DSN: z.string().optional(),
    ZEABUR_SERVICE_ID: z.string().optional(),
    RATELIMIT_WINDOW_MS: z
      .number()
      .optional()
      .default(5 * 60000),
    RATELIMIT_MAX: z.number().optional().default(300),
    OPENAI_API_KEY: z.string().optional(),
    AI_AUTH_PUBLIC_KEY: z.string().optional(),
    AI_AUTH_PRIVATE_KEY: z.string().optional(),
    IP_DENY_LIST: z.string().optional(),
    IP_ALLOW_LIST: z.string().optional(),
    MAINTENANCE_MODE: z.string().optional().default("false"),
    MAINTENANCE_BYPASS_TOKEN: z.string().optional(),
    TIMEOUT_MS: NumericStringSchema,
    PROJECT_ID: NumericStringSchema.optional(),
    TRIGGER_SECRET_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GENAI_API_KEY: z.string().optional(),
    OLLAMA_BASE_URL: z.string().optional(),
  },
  runtimeEnv: {
    PORT: process.env.PORT ? Number(process.env.PORT) : 3005,
    NODE_ENV: process.env.NODE_ENV ?? "development",
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
    AI_AUTH_PUBLIC_KEY: process.env.AI_AUTH_PUBLIC_KEY,
    AI_AUTH_PRIVATE_KEY: process.env.AI_AUTH_PRIVATE_KEY,
    IP_DENY_LIST: process.env.IP_DENY_LIST,
    IP_ALLOW_LIST: process.env.IP_ALLOW_LIST,
    MAINTENANCE_MODE:
      process.env.MAINTENANCE_MODE === "true" ||
      process.env.MAINTENANCE_MODE === "1"
        ? "true"
        : "false",
    MAINTENANCE_BYPASS_TOKEN: process.env.MAINTENANCE_BYPASS_TOKEN,
    TIMEOUT_MS: process.env.TIMEOUT_MS || "10000",
    PROJECT_ID: process.env.PROJECT_ID,
    TRIGGER_SECRET_KEY: process.env.TRIGGER_SECRET_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GENAI_API_KEY: process.env.GENAI_API_KEY,
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
  extends: [spotifyEnv, authEnv, dbEnv, captchaEnv, kvEnv, s3Env, serviceEnv],
});

export type ENV = typeof env;
