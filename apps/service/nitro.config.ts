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
  traceDeps: [
    "pg*",
    "pg-pool*",
    "pino*",
    "@redis/client*",
    "@workflow/world-postgres",
    "workflow",
    "@better-auth/passkey",
    "sharp",
    "@img/*",
  ],
  noPublicDir: true,
  hooks: telemetryEntry(new URL("./server.entry.ts", import.meta.url)),
});
