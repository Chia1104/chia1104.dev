import { initAuthConfig } from "@hono/auth-js";
import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { getConfig } from "@chia/auth-core-esm";

import authRoutes from "@/controllers/auth.controller";
import type { ENV } from "@/env";
import "@/env";

const app = new Hono<{ Bindings: ENV }>();

app.use(
  "*",
  initAuthConfig(() => getConfig())
);

app.route("/api/auth", authRoutes);

const port = Number(process.env.PORT) || 3005;
console.log(
  `Server is running on port ${port}, go to http://localhost:${port}`
);

serve({
  fetch: app.fetch,
  port,
});
