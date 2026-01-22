import { defineConfig } from "nitro";
import { fileURLToPath } from "node:url";

export default defineConfig({
  serverDir: "src",
  modules: ["workflow/nitro"],
  plugins: ["plugins/start-pg-world.ts", "plugins/start-redis-world.ts"],
  typescript: {
    tsconfigPath: "./tsconfig.build.json",
  },
  alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
  },
  preset: "node-server",
  routes: {
    "/**": "./src/server.ts",
  },
});
