import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    BS_UPTIME_TOKEN: z.string().min(1),
    BS_TEL_TOKEN: z.string().min(1),
  },
  runtimeEnv: {
    BS_UPTIME_TOKEN: process.env.BS_UPTIME_TOKEN,
    BS_TEL_TOKEN: process.env.BS_TEL_TOKEN,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
});
