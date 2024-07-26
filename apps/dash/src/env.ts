import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

import { env as spotify } from "@chia/api/spotify/env";
import { nodeEnvSchema, envSchema } from "@chia/utils/src/schema/schema.mjs";

export const getClientEnv = () => {
  if (process.env.NEXT_PUBLIC_ENV) {
    return process.env.NEXT_PUBLIC_ENV;
  }
  if (process.env.NEXT_PUBLIC_VERCEL_ENV) {
    return process.env.NEXT_PUBLIC_VERCEL_ENV;
  }
  if (process.env.RAILWAY_ENVIRONMENT_NAME) {
    return process.env.RAILWAY_ENVIRONMENT_NAME === "production"
      ? "railway-prod"
      : "railway-dev";
  }
  if (process.env.ZEABUR_ENVIRONMENT_NAME) {
    return process.env.ZEABUR_ENVIRONMENT_NAME === "production"
      ? "zeabur-prod"
      : "zeabur-dev";
  }
  return "development";
};

export const env = createEnv({
  server: {
    NODE_ENV: nodeEnvSchema,
    RAILWAY_URL: z.string().optional(),
    VERCEL_URL: z.string().optional(),
    ZEABUR_URL: z.string().optional(),
    ADMIN_ID: z.string().optional(),
    BETA_ADMIN_ID: z.string().optional(),
    DATABASE_URL: z.string().optional(),
    BETA_DATABASE_URL: z.string().optional(),
    INTERNAL_SERVICE_ENDPOINT: z.string().optional(),
  },

  client: {
    NEXT_PUBLIC_ENV: envSchema,
    NEXT_PUBLIC_SERVICE_ENDPOINT: z.string().optional(),
  },

  runtimeEnv: {
    NEXT_PUBLIC_ENV: getClientEnv(),
    NODE_ENV: process.env.NODE_ENV,
    RAILWAY_URL: process.env.RAILWAY_STATIC_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    ZEABUR_URL: process.env.ZEABUR_URL,
    ADMIN_ID: process.env.ADMIN_ID,
    BETA_ADMIN_ID: process.env.BETA_ADMIN_ID,
    DATABASE_URL: process.env.DATABASE_URL,
    BETA_DATABASE_URL: process.env.BETA_DATABASE_URL,
    NEXT_PUBLIC_SERVICE_ENDPOINT: process.env.NEXT_PUBLIC_SERVICE_ENDPOINT,
    INTERNAL_SERVICE_ENDPOINT: process.env.INTERNAL_SERVICE_ENDPOINT,
  },

  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",

  extends: [spotify],
});
