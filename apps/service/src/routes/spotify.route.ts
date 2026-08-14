import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { timeout } from "hono/timeout";

import { completeSpotifyAuthorizationService } from "@chia/api/spotify/account";
import { spotifyOAuthCallbackSchema } from "@chia/api/spotify/validator";

import { env } from "../env";
import { getSpotifyDashboardRedirect } from "../services/spotify.service";

/**
 * Only the OAuth callback stays on Hono: it answers a browser navigation with a 302, so
 * it is HTTP-shaped rather than an application procedure. The playlist and now-playing
 * reads live on the oRPC router as `spotify.playlist` / `spotify.playing` and kept their
 * previous URLs.
 */
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
