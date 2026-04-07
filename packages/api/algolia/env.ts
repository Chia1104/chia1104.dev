import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  server: {
    ALGOLIA_APPLICATION_ID: z.string().optional(),
    ALGOLIA_API_KEY: z.string().optional(),
    ALGOLIA_FEEDS_INDEX_NAME: z.string().optional().default("dev_FEEDS"),
  },
  runtimeEnv: {
    ALGOLIA_APPLICATION_ID: process.env.ALGOLIA_APPLICATION_ID,
    ALGOLIA_API_KEY: process.env.ALGOLIA_API_KEY,
    ALGOLIA_FEEDS_INDEX_NAME: process.env.ALGOLIA_FEEDS_INDEX_NAME,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
});
