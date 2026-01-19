import { Elysia } from "elysia";

import { auth } from "@chia/auth";

import { env } from "./env";

const app = new Elysia().mount(auth.handler).listen(env.PORT);

console.log(
  `🦊 Auth Service is running at ${app.server?.protocol}://${app.server?.hostname}:${app.server?.port}`
);
