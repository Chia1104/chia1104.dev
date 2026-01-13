import { defineNitroConfig } from "nitro/config";
import { fileURLToPath } from "node:url";

export default defineNitroConfig({
  serverDir: "src",
  // modules: ["workflow/nitro"],
  /**
   * @TODO: update workflow db schema
   */
  // plugins: ["/plugins/start-pg-world.ts"],
  typescript: {
    tsconfigPath: "./tsconfig.build.json",
  },
  alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
  },
  noExternals: false,
});
