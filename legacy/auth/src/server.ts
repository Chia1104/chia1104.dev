import { Elysia } from "elysia";

import { createAuth } from "@chia/auth";
import { connectDatabase } from "@chia/db/client";
import { kv } from "@chia/kv";

import { env } from "./env";

const db = await connectDatabase();

const app = new Elysia()
  .get("/auth/health", () => {
    return {
      status: "ok",
    };
  })
  .mount(createAuth(db, kv).handler)
  .listen(env.PORT);

console.log(
  `🦊 Auth Service is running at ${app.server?.protocol}://${app.server?.hostname}:${app.server?.port}`
);
