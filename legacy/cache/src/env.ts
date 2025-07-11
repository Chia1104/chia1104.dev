import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    CACHE_PROVIDER: z.enum(["upstash", "redis"]).optional().default("upstash"),
    UPSTASH_URL: z.string().optional(),
    UPSTASH_TOKEN: z.string().optional(),
    REDIS_URL: z.string().optional(),
    REDIS_URI: z.string().optional(),
  },
  runtimeEnv: {
    CACHE_PROVIDER: process.env.CACHE_PROVIDER ?? "upstash",
    UPSTASH_URL: process.env.REDIS_URL,
    UPSTASH_TOKEN: process.env.UPSTASH_TOKEN,
    REDIS_URL: process.env.REDIS_URL,
    REDIS_URI: process.env.REDIS_URI,
  },
  clientPrefix: "NEXT_PUBLIC_",
  client: {},
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
});
