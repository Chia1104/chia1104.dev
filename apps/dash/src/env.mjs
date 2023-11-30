// @ts-check

import { z } from "zod";
import { createEnv } from "@t3-oss/env-nextjs";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    RAILWAY_URL: z.string().optional(),
    VERCEL_URL: z.string().optional(),
    ZEABUR_URL: z.string().optional(),
    ADMIN_ID: z.string().optional(),
    BETA_ADMIN_ID: z.string().optional(),
    DATABASE_URL: z.string().optional(),
    BETA_DATABASE_URL: z.string().optional(),
  },

  client: {
    NEXT_PUBLIC_ENV: z
      .enum([
        "preview",
        "development",
        "local",
        "beta",
        "gamma",
        "prod",
        "production",
        "test",
        "zeabur-prod",
        "vercel-prod",
        "railway-prod",
        "zeabur-dev",
        "vercel-dev",
        "railway-dev",
      ])
      .default("development"),
  },

  runtimeEnv: {
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
    NODE_ENV: process.env.NODE_ENV,
    RAILWAY_URL: process.env.RAILWAY_STATIC_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    ZEABUR_URL: process.env.ZEABUR_URL,
    ADMIN_ID: process.env.ADMIN_ID,
    BETA_ADMIN_ID: process.env.BETA_ADMIN_ID,
    DATABASE_URL: process.env.DATABASE_URL,
    BETA_DATABASE_URL: process.env.BETA_DATABASE_URL,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
