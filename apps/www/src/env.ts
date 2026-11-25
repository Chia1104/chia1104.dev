import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

import { env as captchaEnv } from "@chia/integrations/captcha/env.client";
import { env as githubEnv } from "@chia/integrations/github/env";
import { externalInfraEnv as serviceEnv } from "@chia/services/env";
import { NodeEnvSchema, AppEnvSchema } from "@chia/utils/schema";

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
  return "development";
};

export const env = createEnv({
  server: {
    NODE_ENV: NodeEnvSchema,
    SENTRY_AUTH_TOKEN: z.string().optional(),
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),
    SPOTIFY_FAVORITE_PLAYLIST_ID: z.string().optional(),
  },

  client: {
    NEXT_PUBLIC_ENV: AppEnvSchema,
    NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
    NEXT_PUBLIC_DEFAULT_TIME_ZONE: z.string().min(1),
    NEXT_PUBLIC_ENABLE_SENTRY: z.boolean().optional().default(true),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_ENV: getClientEnv(),
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    NEXT_PUBLIC_DEFAULT_TIME_ZONE:
      process.env.NEXT_PUBLIC_DEFAULT_TIME_ZONE || "Asia/Taipei",
    SPOTIFY_FAVORITE_PLAYLIST_ID: process.env.SPOTIFY_FAVORITE_PLAYLIST_ID,
    NEXT_PUBLIC_ENABLE_SENTRY:
      process.env.NEXT_PUBLIC_ENABLE_SENTRY === "true" ||
      process.env.NEXT_PUBLIC_ENABLE_SENTRY === "1",
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
  emptyStringAsUndefined: true,
  extends: [githubEnv, captchaEnv, serviceEnv],
});
