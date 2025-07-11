import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const adminEnv = createEnv({
  server: {
    ADMIN_ID: z.string().optional(),
    BETA_ADMIN_ID: z.string().optional(),
    LOCAL_ADMIN_ID: z.string().optional(),
  },
  runtimeEnv: {
    ADMIN_ID: process.env.ADMIN_ID,
    BETA_ADMIN_ID: process.env.BETA_ADMIN_ID,
    LOCAL_ADMIN_ID: process.env.LOCAL_ADMIN_ID,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
  emptyStringAsUndefined: true,
});

export const env = createEnv({
  server: {
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().min(1).optional(),
    AUTH_URL: z.string().optional(),
    AUTH_COOKIE_DOMAIN: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    CORS_ALLOWED_ORIGIN: z.string().optional(),
    CF_BYPASS_TOKEN: z.string().optional(),
    CH_API_KEY: z.string().optional(),
  },
  runtimeEnv: {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    AUTH_COOKIE_DOMAIN: process.env.AUTH_COOKIE_DOMAIN ?? ".chia1104.dev",
    RESEND_API_KEY: process.env.RESEND_API_KEY ?? "re_123",
    CORS_ALLOWED_ORIGIN: process.env.CORS_ALLOWED_ORIGIN,
    CF_BYPASS_TOKEN: process.env.CF_BYPASS_TOKEN,
    CH_API_KEY: process.env.CH_API_KEY,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1" ||
    process.env.APP_CODE !== "service",
  extends: [adminEnv],
});
