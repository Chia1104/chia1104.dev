import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  server: {
    ALGOLIA_APPLICATION_ID: z.string().min(1),
    ALGOLIA_API_KEY: z.string().min(1),
    FEEDS_INDEX_NAME: z.string().optional().default("dev_FEEDS"),
  },
  runtimeEnv: {
    ALGOLIA_APPLICATION_ID: process.env.ALGOLIA_APPLICATION_ID,
    ALGOLIA_API_KEY: process.env.ALGOLIA_API_KEY,
    FEEDS_INDEX_NAME: process.env.FEEDS_INDEX_NAME,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
});
