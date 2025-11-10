import { S3Client } from "@aws-sdk/client-s3";

import { env } from "./env";

export const r2Client = new S3Client({
  region: env.S3_REGION,
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});
