import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

/**
 * `RESEND_API_KEY` is optional here even though sending requires it. This module is
 * reached from the oRPC router, which `apps/dash` imports; a required var would throw
 * in every app that never sends email. `sendContactEmail` reports the missing key.
 */
export const env = createEnv({
  server: {
    RESEND_API_KEY: z.string().optional(),
  },
  runtimeEnv: {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
});
