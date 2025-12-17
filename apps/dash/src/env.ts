import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

import { env as serviceEnv } from "@chia/api/services/env";
import { adminEnv } from "@chia/auth/env";
import { env as dbEnv } from "@chia/db/env";
import { NodeEnvSchema, AppEnvSchema } from "@chia/utils/schema";

export const getClientEnv = () => {
  if (process.env.NEXT_PUBLIC_ENV || process.env.NEXT_PUBLIC_APP_ENV) {
    return process.env.NEXT_PUBLIC_ENV || process.env.NEXT_PUBLIC_APP_ENV;
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
    NODE_ENV: NodeEnvSchema,
    RAILWAY_URL: z.string().optional(),
    VERCEL_URL: z.string().optional(),
    ZEABUR_URL: z.string().optional(),
  },

  client: {
    NEXT_PUBLIC_APP_ENV: AppEnvSchema,
  },

  runtimeEnv: {
    NEXT_PUBLIC_APP_ENV: getClientEnv(),
    NODE_ENV: process.env.NODE_ENV,
    RAILWAY_URL: process.env.RAILWAY_STATIC_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    ZEABUR_URL: process.env.ZEABUR_URL,
  },

  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",

  extends: [dbEnv, adminEnv, serviceEnv],
});
