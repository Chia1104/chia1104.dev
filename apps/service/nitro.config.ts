import { defineConfig } from "nitro";

import { telemetryEntry } from "@chia/observability/nitro";

export default defineConfig({
  serverDir: "src",
  plugins: ["./plugins/start-pg-world.ts", "./plugins/feed-draft-listener.ts"],
  routesDir: "nitro/routes",
  apiDir: "nitro/api",
  typescript: {
    tsConfig: {
      extends: ["./tsconfig.json"],
      include: ["**/*.ts"],
      exclude: [
        "**/*.spec.mts",
        "**/*.test.mts",
        "__tests__",
        "tsdown.config.ts",
        "vitest.config.mts",
      ],
    },
  },
  preset: "node-server",
  // srvx FastResponse drops the status of a response passed as `init`, which Hono does when it
  // re-wraps a reply, so every response would leave as 200.
  features: { fastResponse: false },
  traceDeps: [
    "pg*",
    "pg-pool*",
    "pino*",
    "@redis/client*",
    "@workflow/world-postgres",
    "workflow",
    "sharp",
    "@img/*",
  ],
  noPublicDir: true,
  hooks: telemetryEntry(new URL("./server.entry.ts", import.meta.url)),
});
