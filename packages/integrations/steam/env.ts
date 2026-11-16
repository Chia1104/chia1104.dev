import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  server: {
    /** From https://steamcommunity.com/dev/apikey */
    STEAM_API_KEY: z.string().min(1),
    /** The site owner's 64-bit SteamID. Its game details must be public for the Web API to answer. */
    STEAM_ID: z.string().regex(/^\d{17}$/),
  },
  runtimeEnv: {
    STEAM_API_KEY: process.env.STEAM_API_KEY,
    STEAM_ID: process.env.STEAM_ID,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
});
