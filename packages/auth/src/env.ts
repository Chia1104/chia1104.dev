import { createEnv } from "@t3-oss/env-core";
import { vercel } from "@t3-oss/env-core/presets-zod";
import { z } from "zod";

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
    INTERNAL_REQUEST_SECRET: z.string().optional(),
    CORS_ALLOWED_ORIGIN: z.string().optional(),
  },
  runtimeEnv: {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    AUTH_COOKIE_DOMAIN: process.env.AUTH_COOKIE_DOMAIN ?? ".chia1104.dev",
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    INTERNAL_REQUEST_SECRET: process.env.INTERNAL_REQUEST_SECRET,
    CORS_ALLOWED_ORIGIN: process.env.CORS_ALLOWED_ORIGIN,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1" ||
    process.env.APP_CODE !== "service",
  extends: [vercel()],
});
