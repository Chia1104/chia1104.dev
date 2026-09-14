import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  server: {
    /** Telemetry starts only when set; the SDK reads the other `OTEL_*` variables itself. */
    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
    OTEL_TRACES_EXPORTER: z.enum(["otlp", "console"]).optional(),
    RAILWAY_GIT_COMMIT_SHA: z.string().optional(),
    RAILWAY_ENVIRONMENT_NAME: z.string().optional(),
    /** Errors are sent only in production, and only when set. */
    SENTRY_DSN: z.string().optional(),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .optional()
      .default("development"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .optional()
      .default("info"),
  },
  runtimeEnv: {
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    OTEL_TRACES_EXPORTER: process.env.OTEL_TRACES_EXPORTER,
    RAILWAY_GIT_COMMIT_SHA: process.env.RAILWAY_GIT_COMMIT_SHA,
    RAILWAY_ENVIRONMENT_NAME: process.env.RAILWAY_ENVIRONMENT_NAME,
    SENTRY_DSN: process.env.SENTRY_DSN,
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
});
