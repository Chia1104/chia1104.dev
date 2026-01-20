import { Elysia } from "elysia";

import { auth } from "@chia/auth";

import { env } from "./env";

const app = new Elysia()
  .get("/health", () => {
    return {
      status: "ok",
    };
  })
  .mount(auth.handler);

console.log(
  `🦊 Auth Service is running at ${app.server?.protocol}://${app.server?.hostname}:${app.server?.port}`
);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
