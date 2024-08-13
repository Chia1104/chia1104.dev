import { initAuthConfig } from "@hono/auth-js";
import { showRoutes } from "hono/dev";
import { createApp } from "honox/server";

import { getConfig } from "@chia/auth-core-esm";

import type { ENV } from "@/env";
import "@/env";

const app = createApp<{ Bindings: ENV }>();

app.use(
  "*",
  initAuthConfig(() => getConfig())
);

showRoutes(app);

export default app;
