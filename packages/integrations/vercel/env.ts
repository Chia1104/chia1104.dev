import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

/** Optional as a set: an environment without a www project on Vercel, such as beta, leaves all three unset. */
export const env = createEnv({
  server: {
    /** Needs access to `VERCEL_PROJECT_ID`'s team. */
    VERCEL_TOKEN: z.string().min(1).optional(),
    VERCEL_TEAM_ID: z.string().min(1).optional(),
    VERCEL_PROJECT_ID: z.string().min(1).optional(),
  },
  runtimeEnv: {
    VERCEL_TOKEN: process.env.VERCEL_TOKEN,
    VERCEL_TEAM_ID: process.env.VERCEL_TEAM_ID,
    VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID,
  },
  // `.env.example` leaves them blank, which means unset rather than invalid.
  emptyStringAsUndefined: true,
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
});
