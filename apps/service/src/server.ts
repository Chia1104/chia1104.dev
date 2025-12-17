import { serve } from "@hono/node-server";
import { getRuntimeKey } from "hono/adapter";

import bootstrap from "@/bootstrap";
import appFactory from "@/factories/app.factory";

export const app = appFactory.createApp();

const port = Number(process.env.PORT) || 3005;

bootstrap(app, port);

if (getRuntimeKey() === "node") {
  serve({
    fetch: app.fetch,
    port,
  });
}

export default {
  port,
  fetch: app.fetch,
};
