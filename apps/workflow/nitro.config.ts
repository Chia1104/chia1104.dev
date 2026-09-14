import { defineConfig } from "nitro";

import { telemetryEntry } from "@chia/observability/nitro";

export default defineConfig({
  serverDir: "src",
  routesDir: "nitro/routes",
  apiDir: "nitro/api",
  modules: ["workflow/nitro"],
  plugins: ["plugins/start-pg-world.ts"],
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
  traceDeps: [
    "pg*",
    "pg-pool*",
    "pino*",
    "@workflow-worlds/redis",
    "@workflow/world-postgres",
    "workflow",
  ],
  noPublicDir: true,
  hooks: telemetryEntry(new URL("./server.entry.ts", import.meta.url)),
});
