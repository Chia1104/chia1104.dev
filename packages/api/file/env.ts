import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  server: {
    R2_ACCOUNT_ID: z.string().min(1),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_REGION: z.string().min(1),
    S3_BUCKET_NAME: z.string().min(1),
  },
  runtimeEnv: {
    R2_ACCOUNT_ID: process.env.S3_ACCOUNT_ID,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    S3_REGION: process.env.S3_REGION ?? "auto",
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
});
