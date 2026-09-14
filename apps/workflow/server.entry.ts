import { startTelemetry } from "@chia/observability/node";

startTelemetry({ serviceName: "workflow" });

// Dynamic so nothing in the server graph is linked before the loader hook exists.
await import("#observability/preset-entry");
