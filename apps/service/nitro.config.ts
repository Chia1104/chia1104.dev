import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "src",
  modules: ["workflow/nitro"],
  plugins: ["plugins/start-pg-world.ts", "plugins/start-redis-world.ts"],
  typescript: {
    tsconfigPath: "./tsconfig.build.json",
  },
  preset: process.env.NITRO_PRESET === "bun" ? "bun" : "node-server",
  routes: {
    "/**": "./src/server.ts",
  },
  traceDeps: [
    "jsdom",
    "@workflow-worlds/redis",
    "@workflow/world-postgres",
    "workflow",
  ],
  noPublicDir: true,
});
