import { randomUUID } from "node:crypto";

import { metrics, ValueType } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
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
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { ORPCInstrumentation } from "@orpc/opentelemetry";
import { init as initSentry } from "@sentry/node-core/light";
import { otlpIntegration } from "@sentry/node-core/light/otlp";
import { register } from "import-in-the-middle/register-hooks.mjs";

import { env } from "./env";
import { contentFreeExporter } from "./span-export";

/** Incubating semconv keys; copied rather than imported, as the package advises. */
const ATTR_DEPLOYMENT_ENVIRONMENT_NAME = "deployment.environment.name";
const ATTR_SERVICE_INSTANCE_ID = "service.instance.id";
const METRIC_PROCESS_MEMORY_USAGE = "process.memory.usage";

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
    // Given an exporter, the SDK no longer builds one from `OTEL_TRACES_EXPORTER`; `console` is
    // the only other value this reads, for local runs.
    traceExporter: contentFreeExporter(
      env.OTEL_TRACES_EXPORTER === "console"
        ? new ConsoleSpanExporter()
        : new OTLPTraceExporter()
    ),
    // A supplied resource replaces the SDK default, which carries `telemetry.sdk.*`.
    resource: defaultResource().merge(
      resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: env.RAILWAY_GIT_COMMIT_SHA,
        [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: env.RAILWAY_ENVIRONMENT_NAME,
        // Per process: during a redeploy the old and new replica export side by side, possibly
        // under the same commit.
        [ATTR_SERVICE_INSTANCE_ID]: randomUUID(),
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
  observeProcessMemory();

  process.once("SIGTERM", () => {
    void sdk.shutdown();
  });
};

/**
 * Exports resident set size and V8's off-heap allocations, which the runtime instrumentation's
 * heap metrics leave out.
 */
const observeProcessMemory = () => {
  const meter = metrics.getMeter("@chia/observability");
  const rss = meter.createObservableUpDownCounter(METRIC_PROCESS_MEMORY_USAGE, {
    description: "Resident set size of the process.",
    unit: "By",
    valueType: ValueType.INT,
  });
  const external = meter.createObservableUpDownCounter(
    "nodejs.memory.external",
    {
      description:
        "Memory of C++ objects bound to JavaScript objects, including array buffers.",
      unit: "By",
      valueType: ValueType.INT,
    }
  );
  const arrayBuffers = meter.createObservableUpDownCounter(
    "nodejs.memory.array_buffers",
    {
      description:
        "Memory of ArrayBuffers and SharedArrayBuffers, including Buffers.",
      unit: "By",
      valueType: ValueType.INT,
    }
  );

  meter.addBatchObservableCallback(
    (result) => {
      const usage = process.memoryUsage();
      result.observe(rss, usage.rss);
      result.observe(external, usage.external);
      result.observe(arrayBuffers, usage.arrayBuffers);
    },
    [rss, external, arrayBuffers]
  );
};
