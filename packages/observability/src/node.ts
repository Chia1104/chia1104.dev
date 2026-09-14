import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { RedisInstrumentation } from "@opentelemetry/instrumentation-redis";
import { RuntimeNodeInstrumentation } from "@opentelemetry/instrumentation-runtime-node";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import {
  defaultResource,
  resourceFromAttributes,
} from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { ORPCInstrumentation } from "@orpc/opentelemetry";
import { init as initSentry } from "@sentry/node-core/light";
import { otlpIntegration } from "@sentry/node-core/light/otlp";
import { register } from "import-in-the-middle/register-hooks.mjs";

import { env } from "./env";

/** Incubating semconv key; copied rather than imported, as the package advises. */
const ATTR_DEPLOYMENT_ENVIRONMENT_NAME = "deployment.environment.name";

export interface StartTelemetryOptions {
  serviceName: string;
}

/**
 * Starts OpenTelemetry for a Node server when `OTEL_EXPORTER_OTLP_ENDPOINT` is set, then
 * Sentry error reporting when `SENTRY_DSN` is set.
 *
 * Call it before the server is imported: the loader hook only sees modules loaded after it.
 * Instrumented libraries must stay outside the app bundle, each at a single version: a
 * duplicate is traced into `node_modules/.nf3/`, where the hook cannot name it.
 */
export const startTelemetry = ({ serviceName }: StartTelemetryOptions) => {
  if (env.OTEL_EXPORTER_OTLP_ENDPOINT) startOpenTelemetry(serviceName);

  // After the SDK: the OTLP integration reads the active span through the global API.
  initSentry({
    dsn: env.SENTRY_DSN,
    enabled: Boolean(env.SENTRY_DSN) && env.NODE_ENV === "production",
    environment: env.RAILWAY_ENVIRONMENT_NAME,
    release: env.RAILWAY_GIT_COMMIT_SHA,
    // Trace context travels as W3C `traceparent`; errors join it through the integration.
    tracePropagationTargets: [],
    integrations: [otlpIntegration({ setupOtlpTracesExporter: false })],
  });
};

const startOpenTelemetry = (serviceName: string) => {
  register();
  const sdk = new NodeSDK({
    // A supplied resource replaces the SDK default, which carries `telemetry.sdk.*`.
    resource: defaultResource().merge(
      resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: env.RAILWAY_GIT_COMMIT_SHA,
        [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: env.RAILWAY_ENVIRONMENT_NAME,
      })
    ),
    instrumentations: [
      // Server spans come from `bootstrap()`'s Hono middleware, which names them by route.
      // Not `ignoreIncomingRequestHook`: an ignored request suppresses every span under it.
      new HttpInstrumentation({ disableIncomingRequestInstrumentation: true }),
      new UndiciInstrumentation(),
      // Without a parent these are job polling and LISTEN connections, not request work.
      new PgInstrumentation({ requireParentSpan: true }),
      new RedisInstrumentation({ requireParentSpan: true }),
      new RuntimeNodeInstrumentation(),
      new PinoInstrumentation(),
      new ORPCInstrumentation({ propagationEnabled: false }),
    ],
  });
  sdk.start();

  process.once("SIGTERM", () => {
    void sdk.shutdown();
  });
};
