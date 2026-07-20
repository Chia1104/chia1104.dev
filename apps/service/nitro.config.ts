import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "src",
  typescript: {
    tsconfigPath: "./tsconfig.build.json",
  },
  preset: process.env.NITRO_PRESET === "bun" ? "bun" : "node-server",
  routes: {
    "/**": "./src/server.ts",
  },
  traceDeps: ["jsdom", "@better-auth/passkey"],
  noPublicDir: true,
});
