import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

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
    AUTH_SECRET: z.string().min(1),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    AUTH_REDIRECT_PROXY_URL: z.string().optional(),
    AUTH_URL: z.string().optional(),
    AUTH_COOKIE_DOMAIN: z.string().optional(),
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
  },
  runtimeEnv: {
    PORT: process.env.PORT ? Number(process.env.PORT) : 3005,
    NODE_ENV: process.env.NODE_ENV ?? "development",
    REDIS_URL: process.env.REDIS_URL,
    REDIS_URI: process.env.REDIS_URI,
    CORS_ALLOWED_ORIGIN: process.env.CORS_ALLOWED_ORIGIN,
    AUTH_SECRET: process.env.AUTH_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    AUTH_REDIRECT_PROXY_URL: process.env.AUTH_REDIRECT_PROXY_URL,
    AUTH_URL: process.env.AUTH_URL,
    AUTH_COOKIE_DOMAIN: process.env.AUTH_COOKIE_DOMAIN,
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
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
});

export type ENV = typeof env;
