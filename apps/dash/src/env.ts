import { createEnv } from "@t3-oss/env-nextjs";

import { env as serviceEnv } from "@chia/services/env";
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
  return "development";
};

export const env = createEnv({
  server: {
    NODE_ENV: NodeEnvSchema,
  },

  client: {
    NEXT_PUBLIC_APP_ENV: AppEnvSchema,
  },

  runtimeEnv: {
    NEXT_PUBLIC_APP_ENV: getClientEnv(),
    NODE_ENV: process.env.NODE_ENV,
  },

  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",

  extends: [serviceEnv],
});
