import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    DATABASE_URL_REPLICA_1: z.string().optional(),
    BETA_DATABASE_URL: z.string().optional(),
    LOCAL_DATABASE_URL: z.string().optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_REPLICA_1: process.env.DATABASE_URL_REPLICA_1,
    BETA_DATABASE_URL: process.env.BETA_DATABASE_URL,
    LOCAL_DATABASE_URL: process.env.LOCAL_DATABASE_URL,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
});
