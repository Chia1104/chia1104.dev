import { authHandler } from "@hono/auth-js";
import { Hono } from "hono";

const api = new Hono<HonoContext>();

api.use("*", authHandler());

export default api;
