import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  server: {
    OPENAI_API_KEY: z.string().min(1),
    INTERNAL_SERVICE_ENDPOINT: z.string().min(1),
    CF_BYPASS_TOKEN: z.string().min(1),
    CH_API_KEY: z.string().min(1),
  },
  runtimeEnv: process.env,
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1" ||
    process.env.APP_CODE === "service",
  emptyStringAsUndefined: true,
});
