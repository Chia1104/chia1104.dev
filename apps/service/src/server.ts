import { serve } from "@hono/node-server";
import { getRuntimeKey } from "hono/adapter";

import bootstrap from "@/bootstrap";
import dbFactory from "@/factories/db.factory";

export const app = dbFactory.createApp();

const port = Number(process.env.PORT) || 3005;

bootstrap(app, port);

if (getRuntimeKey() === "node") {
  serve({
    fetch: app.fetch,
    port,
  });
}

export default {
  fetch: app.fetch,
  port,
};
