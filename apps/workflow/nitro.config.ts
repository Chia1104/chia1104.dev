import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "src",
  routesDir: "nitro/routes",
  apiDir: "nitro/api",
  modules: ["workflow/nitro"],
  plugins: ["plugins/start-workflow-world.ts"],
  typescript: { tsconfigPath: "./tsconfig.build.json" },
  preset: "node-server",
  traceDeps: ["@workflow-worlds/redis", "@workflow/world-postgres", "workflow"],
  noPublicDir: true,
});
