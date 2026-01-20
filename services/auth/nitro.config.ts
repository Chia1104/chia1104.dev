import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  serverDir: "src",
  typescript: {
    tsconfigPath: "./tsconfig.build.json",
  },
  preset: "bun",
});
