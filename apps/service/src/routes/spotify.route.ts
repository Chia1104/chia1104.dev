import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { timeout } from "hono/timeout";

import { spotifyOAuthCallbackSchema } from "@chia/integrations/spotify/validator";
import { completeSpotifyAuthorizationService } from "@chia/services/spotify/account.service";

import { env } from "../env";
import { getSpotifyDashboardRedirect } from "../services/spotify.service";

/** Browser OAuth callback; the response is a 302. */
const api = new Hono<HonoContext>().use(timeout(env.TIMEOUT_MS)).get(
  "/oauth/callback",
  zValidator("query", spotifyOAuthCallbackSchema, (result, c) => {
    if (!result.success) {
      return c.redirect(getSpotifyDashboardRedirect("invalid_callback"));
    }
  }),
  async (c) => {
    try {
      const status = await completeSpotifyAuthorizationService(
        c.var.db,
        c.var.kv,
        c.req.valid("query")
      );
      return c.redirect(getSpotifyDashboardRedirect(status));
    } catch (err) {
      console.error(err);
      c.get("sentry").captureException(err);
      return c.redirect(getSpotifyDashboardRedirect("exchange_failed"));
    }
  }
);

export default api;
