import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "src",
  plugins: ["./plugins/start-pg-world.ts", "./plugins/feed-draft-listener.ts"],
  routesDir: "nitro/routes",
  apiDir: "nitro/api",
  typescript: {
    tsconfigPath: "./tsconfig.build.json",
  },
  preset: process.env.NITRO_PRESET === "bun" ? "bun" : "node-server",
  traceDeps: [
    "@workflow-worlds/redis",
    "@workflow/world-postgres",
    "workflow",
    "@better-auth/passkey",
  ],
  noPublicDir: true,
});
