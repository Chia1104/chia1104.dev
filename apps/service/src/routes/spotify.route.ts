import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { timeout } from "hono/timeout";

import {
  spotifyCredentialUserSchema,
  spotifyOAuthCallbackSchema,
} from "@chia/api/spotify/validator";
import { Role } from "@chia/db/types";
import { errorGenerator } from "@chia/utils/server";

import { env } from "../env";
import { verifyAuth } from "../guards/auth.guard";
import {
  activateSpotifyAccountService,
  completeSpotifyAuthorizationService,
  createSpotifyAuthorizationService,
  disconnectSpotifyAccountService,
  getSpotifyAccountsService,
  getSpotifyDashboardRedirect,
  getSpotifyNowPlayingService,
  getSpotifyPlaylistService,
  SpotifyCredentialNotFoundError,
  SpotifyCredentialUnavailableError,
} from "../services/spotify.service";

const SPOTIFY_ADMIN_ROLES = new Set<string>([Role.Admin, Role.Root]);

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
  )
  .use("/manage/*", verifyAuth())
  .use("/manage/*", async (c, next) => {
    const user = c.get("user");
    if (!user || !SPOTIFY_ADMIN_ROLES.has(user.role)) {
      return c.json(errorGenerator(403), 403);
    }
    await next();
  })
  .get("/manage/accounts", async (c) => {
    const data = await getSpotifyAccountsService(c.var.db, c.get("user").id);
    c.header("Cache-Control", "no-store");
    return c.json(data);
  })
  .post("/manage/authorize", async (c) => {
    try {
      const url = await createSpotifyAuthorizationService(
        c.var.kv,
        c.get("user").id
      );
      c.header("Cache-Control", "no-store");
      return c.json({ url });
    } catch (err) {
      console.error(err);
      c.get("sentry").captureException(err);
      return c.json(errorGenerator(503), 503);
    }
  })
  .post(
    "/manage/accounts/:userId/activate",
    zValidator("param", spotifyCredentialUserSchema, (result, c) => {
      if (!result.success) {
        return c.json(errorGenerator(400), 400);
      }
    }),
    async (c) => {
      try {
        const credential = await activateSpotifyAccountService(
          c.var.db,
          c.req.valid("param").userId
        );
        c.header("Cache-Control", "no-store");
        return c.json(credential);
      } catch (err) {
        if (err instanceof SpotifyCredentialNotFoundError) {
          return c.json(errorGenerator(404), 404);
        }
        throw err;
      }
    }
  )
  .delete("/manage/account", async (c) => {
    await disconnectSpotifyAccountService(c.var.db, c.get("user").id);
    c.header("Cache-Control", "no-store");
    return c.body(null, 204);
  });

export default api;
