import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  server: {
    /** Telemetry starts only when set; the SDK reads the other `OTEL_*` variables itself. */
    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
    RAILWAY_GIT_COMMIT_SHA: z.string().optional(),
    RAILWAY_ENVIRONMENT_NAME: z.string().optional(),
  },
  runtimeEnv: {
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    RAILWAY_GIT_COMMIT_SHA: process.env.RAILWAY_GIT_COMMIT_SHA,
    RAILWAY_ENVIRONMENT_NAME: process.env.RAILWAY_ENVIRONMENT_NAME,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
});
