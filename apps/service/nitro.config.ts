import { fileURLToPath } from "node:url";

import { defineConfig } from "nitro";

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
    "@redis/client*",
    "@workflow-worlds/redis",
    "@workflow/world-postgres",
    "workflow",
    "@better-auth/passkey",
  ],
  noPublicDir: true,
  hooks: {
    // `server.entry.ts` starts telemetry, then imports the preset entry dynamically so the
    // externals it loads (`pg`, `@redis/client`) resolve after the loader hook is registered.
    "build:before"(nitro) {
      if (nitro.options.dev) return;
      nitro.options.alias["#service/preset-entry"] = nitro.options.entry;
      nitro.options.entry = fileURLToPath(
        new URL("./server.entry.ts", import.meta.url)
      );
    },
  },
});
