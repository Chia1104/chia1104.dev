import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

import { env as authEnv } from "@chia/auth/env";
import { env as dbEnv } from "@chia/db/env";
import { env as kvEnv } from "@chia/kv/env";
import { NumericStringSchema } from "@chia/utils/schema";

export const env = createEnv({
  server: {
    PORT: z.number().optional().default(3007),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .optional()
      .default("development"),
    CORS_ALLOWED_ORIGIN: z.string().optional(),
    SENTRY_DSN: z.string().optional(),
    ZEABUR_SERVICE_ID: z.string().optional(),
    TIMEOUT_MS: NumericStringSchema,
    RATELIMIT_WINDOW_MS: z
      .number()
      .optional()
      .default(5 * 60000),
    RATELIMIT_MAX: z.number().optional().default(300),
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GENAI_API_KEY: z.string().optional(),
    AI_GATEWAY_API_KEY: z.string().optional(),
    AI_AUTH_PUBLIC_KEY: z.string().optional(),
    AI_AUTH_PRIVATE_KEY: z.string().optional(),
    OLLAMA_BASE_URL: z.string().optional(),
    INTERNAL_AUTH_SERVICE_ENDPOINT: z.string().optional(),
    INTERNAL_AUTH_SERVICE_TOKEN: z.string().optional(),
  },
  runtimeEnv: {
    PORT: process.env.PORT ? Number(process.env.PORT) : 3007,
    NODE_ENV: process.env.NODE_ENV ?? "development",
    CORS_ALLOWED_ORIGIN: process.env.CORS_ALLOWED_ORIGIN,
    SENTRY_DSN: process.env.SENTRY_DSN,
    ZEABUR_SERVICE_ID: process.env.ZEABUR_SERVICE_ID,
    TIMEOUT_MS: process.env.TIMEOUT_MS || "10000",
    RATELIMIT_WINDOW_MS: process.env.RATELIMIT_WINDOW_MS
      ? Number(process.env.RATELIMIT_WINDOW_MS)
      : 15 * 60000,
    RATELIMIT_MAX: process.env.RATELIMIT_MAX
      ? Number(process.env.RATELIMIT_MAX)
      : 87,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GENAI_API_KEY: process.env.GENAI_API_KEY,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
    AI_AUTH_PUBLIC_KEY: process.env.AI_AUTH_PUBLIC_KEY,
    AI_AUTH_PRIVATE_KEY: process.env.AI_AUTH_PRIVATE_KEY,
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
    INTERNAL_AUTH_SERVICE_ENDPOINT: process.env.INTERNAL_AUTH_SERVICE_ENDPOINT,
    INTERNAL_AUTH_SERVICE_TOKEN: process.env.INTERNAL_AUTH_SERVICE_TOKEN,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
  extends: [authEnv, dbEnv, kvEnv],
});

export type ENV = typeof env;
