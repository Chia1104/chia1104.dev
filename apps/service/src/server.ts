import bootstrap from "@/bootstrap";
import appFactory from "@/factories/app.factory";

export const app = appFactory.createApp();

const port = Number(process.env.PORT) || 3005;

bootstrap(app, port);

export default {
  port,
  fetch: app.fetch,
};
