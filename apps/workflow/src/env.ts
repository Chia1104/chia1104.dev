import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

import { env as algoliaEnv } from "@chia/api/algolia/env";
import { env as dbEnv } from "@chia/db/env";
import { NumericStringSchema } from "@chia/utils/schema";

export const env = createEnv({
  server: {
    PORT: z.number().optional().default(3008),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .optional()
      .default("development"),
    SENTRY_DSN: z.string().optional(),
    ZEABUR_SERVICE_ID: z.string().optional(),
    TIMEOUT_MS: NumericStringSchema,
    INTERNAL_WORKFLOW_SERVICE_TOKEN: z.string().optional(),
    // embedding generation (minimal AI key set — no AI_AUTH_* signing keys)
    OPENAI_API_KEY: z.string().optional(),
    AI_GATEWAY_API_KEY: z.string().optional(),
    OLLAMA_BASE_URL: z.string().optional(),
  },
  runtimeEnv: {
    PORT: process.env.PORT ? Number(process.env.PORT) : 3008,
    NODE_ENV: process.env.NODE_ENV ?? "development",
    SENTRY_DSN: process.env.SENTRY_DSN,
    ZEABUR_SERVICE_ID: process.env.ZEABUR_SERVICE_ID,
    TIMEOUT_MS: process.env.TIMEOUT_MS || "10000",
    INTERNAL_WORKFLOW_SERVICE_TOKEN:
      process.env.INTERNAL_WORKFLOW_SERVICE_TOKEN,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
  extends: [algoliaEnv, dbEnv],
});

export type ENV = typeof env;
