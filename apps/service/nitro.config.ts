import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "src",
  /**
   * Where Nitro's own file-based routes would live — a directory this app does not have.
   *
   * `serverDir` is always scanned, and Nitro's defaults claim `src/routes` and `src/api`.
   * `src/routes` is Hono's: it holds the sub-apps `server.ts` mounts under `/api/v1`, the
   * same `*.route.ts` shape `packages/api/orpc/routes` uses. Left on the defaults, Nitro
   * published each of those files as a route of its own — `/ai.route`, `/auth.route`, … —
   * mounted straight onto the Nitro router. Those bypassed `server.ts` entirely, so they
   * ran without the base path, CORS policy, maintenance gate or request context that
   * `bootstrap()` applies, and exposed the Better Auth handler outside `/api/v1/auth`.
   */
  routesDir: "nitro/routes",
  apiDir: "nitro/api",
  modules: ["workflow/nitro"],
  plugins: ["plugins/start-pg-world.ts", "plugins/start-redis-world.ts"],
  typescript: {
    tsconfigPath: "./tsconfig.build.json",
  },
  preset: process.env.NITRO_PRESET === "bun" ? "bun" : "node-server",
  /**
   * `src/server.ts` is **not** listed under `routes`.
   *
   * Nitro already mounts it: `serverEntry` defaults to resolving `./server` inside
   * `serverDir`. Naming it again as a `/**` route registered the same app twice, and
   * Nitro composes duplicate handlers with `multiHandler(app, app)` — the first copy runs
   * as h3 middleware, which treats any 404 as "not handled" and falls through to the
   * second copy. The retry re-entered the app with the request body already consumed, so
   * every 404 on a POST hung until the request timeout instead of returning.
   */
  traceDeps: [
    "@workflow-worlds/redis",
    "@workflow/world-postgres",
    "workflow",
    "@better-auth/passkey",
  ],
  noPublicDir: true,
});
