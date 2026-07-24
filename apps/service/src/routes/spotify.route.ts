import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { timeout } from "hono/timeout";

import {
  completeSpotifyAuthorizationService,
  SpotifyCredentialUnavailableError,
} from "@chia/api/spotify/account";
import { spotifyOAuthCallbackSchema } from "@chia/api/spotify/validator";
import { errorGenerator } from "@chia/utils/server";

import { env } from "../env";
import {
  getSpotifyDashboardRedirect,
  getSpotifyNowPlayingService,
  getSpotifyPlaylistService,
} from "../services/spotify.service";

const api = new Hono<HonoContext>()
  .use(timeout(env.TIMEOUT_MS))
  .get("/playlist/:id", async (c) => {
    try {
      const data = await getSpotifyPlaylistService(c.req.param("id"));
      return c.json(data);
    } catch (err) {
      console.error(err);
      c.get("sentry").captureException(err);
      return c.json(errorGenerator(500), 500);
    }
  })
  .get("/playing", async (c) => {
    try {
      const data = await getSpotifyNowPlayingService(c.var.db);
      return c.json(data);
    } catch (err) {
      if (err instanceof SpotifyCredentialUnavailableError) {
        return c.json(errorGenerator(503), 503);
      }
      console.error(err);
      c.get("sentry").captureException(err);
      return c.json(errorGenerator(500), 500);
    }
  })
  .get(
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
