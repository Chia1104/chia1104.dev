import { authHandler } from "@hono/auth-js";
import { Hono } from "hono";

import type { ENV } from "@/env";

const api = new Hono<{ Bindings: ENV }>();

api.use("*", authHandler());

export default api;
