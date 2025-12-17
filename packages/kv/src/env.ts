import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  server: {
    CACHE_PROVIDER: z
      .enum(["upstash", "redis", "valkey", "postgres", "auto"])
      .optional()
      .default("auto"),
    UPSTASH_REDIS_REST_URL: z.string().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    REDIS_URI: z.string().optional(),
    VALKEY_URI: z.string().optional(),
    POSTGRES_URI: z.string().optional(),
    CACHE_URI: z.string().optional(),
  },
  runtimeEnv: {
    CACHE_PROVIDER: process.env.CACHE_PROVIDER ?? "auto",
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    REDIS_URI: process.env.REDIS_URI,
    VALKEY_URI: process.env.VALKEY_URI,
    POSTGRES_URI: process.env.POSTGRES_URI,
    CACHE_URI: process.env.CACHE_URI,
  },
  clientPrefix: "NEXT_PUBLIC_",
  client: {},
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
});
