import { Hono } from "hono";
import { getRuntimeKey } from "hono/adapter";

const api = new Hono<HonoContext>();

api.get("/runtime", (c) => c.text(getRuntimeKey()));

export default api;
