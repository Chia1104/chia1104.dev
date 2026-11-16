import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  server: {
    /** TMDB's "API Read Access Token" (v4 auth), sent as a bearer token. */
    TMDB_ACCESS_TOKEN: z.string().min(1),
  },
  runtimeEnv: {
    TMDB_ACCESS_TOKEN: process.env.TMDB_ACCESS_TOKEN,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
});
