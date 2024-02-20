import { z } from "zod";
import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-core/presets";
import { env as githubEnv } from "@chia/api/github/env";
import { env as spotifyEnv } from "@chia/api/spotify/env";
// @ts-ignore
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
    ZEABUR_URL: z.string().optional(),
    SITE_URL: z.string().optional().default("https://www.chia1104.dev"),
    RE_CAPTCHA_KEY: z.string().min(1),
    GOOGLE_API_KEY: z.string().min(1),
    SHA_256_HASH: z.string().min(1),
    RESEND_API_KEY: z.string().min(1),
    UMAMI_DB_URL: z.string().optional(),
    UMAMI_EDGE_DB_URL: z.string().optional(),
    GOOGLE_API: z.string().optional().default("https://www.googleapis.com"),
    EDGE_CONFIG: z.string().optional(),
    SENTRY_AUTH_TOKEN: z.string().optional(),
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),
    ADMIN_ID: z.string().optional(),
    BETA_ADMIN_ID: z.string().optional(),
    DATABASE_URL: z.string().optional(),
    BETA_DATABASE_URL: z.string().optional(),
  },

  client: {
    NEXT_PUBLIC_ENV: envSchema,
    NEXT_PUBLIC_RE_CAPTCHA_KEY: z.string().min(1),
    NEXT_PUBLIC_UMAMI_WEBSITE_ID: z.string().min(1),
    NEXT_PUBLIC_UMAMI_URL: z.string().min(1),
    NEXT_PUBLIC_GISCUS_REPO: z
      .string()
      .optional()
      .default("Chia1104/chia1104.dev"),
    NEXT_PUBLIC_GISCUS_REPO_ID: z.string().min(1),
    NEXT_PUBLIC_GISCUS_CATEGORY_ID: z.string().min(1),
    NEXT_PUBLIC_GISCUS_CATEGORY: z.string().optional().default("Comments"),
    NEXT_PUBLIC_GISCUS_THEME: z.string().optional().default("dark_dimmed"),
    NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
    NEXT_PUBLIC_GTM_ID: z.string().optional(),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_ENV: getClientEnv(),
    RAILWAY_URL: process.env.RAILWAY_STATIC_URL,
    ZEABUR_URL: process.env.ZEABUR_URL,
    SITE_URL: process.env.SITE_URL,
    RE_CAPTCHA_KEY:
      process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test"
        ? "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe"
        : process.env.RE_CAPTCHA_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    SHA_256_HASH: process.env.SHA_256_HASH,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    UMAMI_DB_URL: process.env.UMAMI_DB_URL,
    UMAMI_EDGE_DB_URL: process.env.UMAMI_EDGE_DB_URL,
    NEXT_PUBLIC_RE_CAPTCHA_KEY:
      process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test"
        ? "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
        : process.env.NEXT_PUBLIC_RE_CAPTCHA_KEY,
    NEXT_PUBLIC_UMAMI_WEBSITE_ID: process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID,
    NEXT_PUBLIC_UMAMI_URL: process.env.NEXT_PUBLIC_UMAMI_URL,
    GOOGLE_API: process.env.GOOGLE_API,
    NEXT_PUBLIC_GISCUS_REPO: process.env.NEXT_PUBLIC_GISCUS_REPO,
    NEXT_PUBLIC_GISCUS_REPO_ID: process.env.NEXT_PUBLIC_GISCUS_REPO_ID,
    NEXT_PUBLIC_GISCUS_CATEGORY_ID: process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID,
    NEXT_PUBLIC_GISCUS_CATEGORY: process.env.NEXT_PUBLIC_GISCUS_CATEGORY,
    NEXT_PUBLIC_GISCUS_THEME: process.env.NEXT_PUBLIC_GISCUS_THEME,
    EDGE_CONFIG: process.env.EDGE_CONFIG,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    ADMIN_ID: process.env.ADMIN_ID,
    BETA_ADMIN_ID: process.env.BETA_ADMIN_ID,
    DATABASE_URL: process.env.DATABASE_URL,
    BETA_DATABASE_URL: process.env.BETA_DATABASE_URL,
    NEXT_PUBLIC_GTM_ID: process.env.NEXT_PUBLIC_GTM_ID,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
  emptyStringAsUndefined: true,
  extends: [vercel, spotifyEnv, githubEnv],
});
