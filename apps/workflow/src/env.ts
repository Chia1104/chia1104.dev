import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

import { env as aiEnv } from "@chia/ai/env";
import { env as dbEnv } from "@chia/db/env";
import { NumericStringSchema } from "@chia/utils/schema";

export const env = createEnv({
  server: {
    PORT: z.number().optional().default(3008),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .optional()
      .default("development"),
    INTERNAL_WORKFLOW_SERVICE_TOKEN: z.string().min(32),
    WORKFLOW_TARGET_WORLD: z.string().optional(),
    WORKFLOW_POSTGRES_URL: z.url().optional(),
    WORKFLOW_POSTGRES_JOB_PREFIX: z.string().min(1).optional(),
    WORKFLOW_POSTGRES_WORKER_CONCURRENCY: NumericStringSchema.optional(),
    WORKFLOW_POSTGRES_MAX_POOL_SIZE: NumericStringSchema.optional(),
    WORKFLOW_REDIS_URI: z.url().optional(),
    ADMIN_ID: z.string().optional(),
    LOCAL_ADMIN_ID: z.string().optional(),
    BETA_ADMIN_ID: z.string().optional(),
    AI_AUTH_PRIVATE_KEY: z.string().optional(),
    AI_GATEWAY_API_KEY: z.string().optional(),
    FIRECRAWL_API_KEY: z.string().min(1),
  },
  runtimeEnv: {
    PORT: process.env.PORT ? Number(process.env.PORT) : 3008,
    NODE_ENV: process.env.NODE_ENV ?? "development",
    INTERNAL_WORKFLOW_SERVICE_TOKEN:
      process.env.INTERNAL_WORKFLOW_SERVICE_TOKEN,
    WORKFLOW_TARGET_WORLD: process.env.WORKFLOW_TARGET_WORLD,
    WORKFLOW_POSTGRES_URL: process.env.WORKFLOW_POSTGRES_URL,
    WORKFLOW_POSTGRES_JOB_PREFIX: process.env.WORKFLOW_POSTGRES_JOB_PREFIX,
    WORKFLOW_POSTGRES_WORKER_CONCURRENCY:
      process.env.WORKFLOW_POSTGRES_WORKER_CONCURRENCY,
    WORKFLOW_POSTGRES_MAX_POOL_SIZE:
      process.env.WORKFLOW_POSTGRES_MAX_POOL_SIZE,
    WORKFLOW_REDIS_URI: process.env.WORKFLOW_REDIS_URI,
    ADMIN_ID: process.env.ADMIN_ID,
    LOCAL_ADMIN_ID: process.env.LOCAL_ADMIN_ID,
    BETA_ADMIN_ID: process.env.BETA_ADMIN_ID,
    AI_AUTH_PRIVATE_KEY: process.env.AI_AUTH_PRIVATE_KEY,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
    FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
  extends: [dbEnv, aiEnv],
});
