import { Hono } from "hono";
import { timeout } from "hono/timeout";

import { env } from "../env";
import { captchaGuard } from "../guards/captcha.guard";

/** Entry points that mint a session for an unknown caller; a human must be present. */
const CAPTCHA_PATHS = [
  "/sign-in/anonymous",
  "/sign-in/social",
  "/sign-in/magic-link",
];

/**
 * @TODO: Remove this route when the auth service is migrated to separate service
 */
const api = new Hono<HonoContext>()
  .use(timeout(env.TIMEOUT_MS))
  .on("POST", CAPTCHA_PATHS, captchaGuard())
  .on(["GET", "POST"], ["*"], async (c) => {
    if (!c.var.auth) {
      return c.json({ message: "Unauthorized" }, 401);
    }
    return await c.var.auth.handler(c.req.raw);
  });

export default api;
