import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  server: {
    /** IGDB authenticates as a Twitch application. */
    IGDB_CLIENT_ID: z.string().min(1),
    IGDB_CLIENT_SECRET: z.string().min(1),
  },
  runtimeEnv: {
    IGDB_CLIENT_ID: process.env.IGDB_CLIENT_ID,
    IGDB_CLIENT_SECRET: process.env.IGDB_CLIENT_SECRET,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
});
