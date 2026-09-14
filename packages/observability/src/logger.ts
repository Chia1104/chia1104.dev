import pino from "pino";

import { env } from "./env";

/** Structured fields beside a log line; keep them to identifiers, codes and counts. */
export type LogFields = Record<
  string,
  string | number | boolean | null | undefined
>;

/**
 * JSON logs on stdout. While telemetry runs, each record also carries `trace_id` and
 * `span_id` and is exported over OTLP.
 */
export const logger = pino({
  // Validation, and so the schema default, is skipped under `SKIP_ENV_VALIDATION`.
  level: env.LOG_LEVEL ?? "info",
  serializers: { err: pino.stdSerializers.errWithCause },
  redact: {
    paths: [
      "authorization",
      "cookie",
      "credentials",
      "apiKey",
      "token",
      "headers",
      "*.authorization",
      "*.cookie",
      "*.credentials",
      "*.apiKey",
      "*.token",
      "*.headers",
    ],
    censor: "[Redacted]",
  },
});
