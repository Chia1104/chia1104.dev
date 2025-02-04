import { syncEnvVars } from "@trigger.dev/build/extensions/core";
import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_xrcchuyhkluewviwoqts",
  runtime: "node",
  logLevel: "log",
  maxDuration: 300,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["tasks"],
  build: {
    extensions: [
      syncEnvVars(() => {
        return {
          OPENAI_API_KEY: process.env.OPENAI_API_KEY,
          INTERNAL_SERVICE_ENDPOINT: process.env.INTERNAL_SERVICE_ENDPOINT,
          INTERNAL_REQUEST_SECRET: process.env.INTERNAL_REQUEST_SECRET,
        };
      }),
    ],
  },
});
