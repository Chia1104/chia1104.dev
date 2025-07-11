import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    INTERNAL_SERVICE_ENDPOINT: z.string().min(1),
  },
  clientPrefix: "NEXT_PUBLIC_",
  client: {
    NEXT_PUBLIC_SERVICE_ENDPOINT: z.string().min(1),
  },
  runtimeEnv: {
    INTERNAL_SERVICE_ENDPOINT: process.env.INTERNAL_SERVICE_ENDPOINT,
    NEXT_PUBLIC_SERVICE_ENDPOINT: process.env.NEXT_PUBLIC_SERVICE_ENDPOINT,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1" ||
    process.env.APP_CODE !== "service",
});

export const externalInfraEnv = createEnv({
  server: {
    CF_BYPASS_TOKEN: z.string().min(1),
    CH_API_KEY: z.string().optional(),
  },
  runtimeEnv: {
    CF_BYPASS_TOKEN: process.env.CF_BYPASS_TOKEN,
    CH_API_KEY: process.env.CH_API_KEY,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1" ||
    process.env.APP_CODE !== "service",
  extends: [env],
});
