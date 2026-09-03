import { ApiKeyScope } from "@chia/auth/apikey";
import { CallerTier } from "@chia/service-kit/policies/caller.policy";

import {
  activateSpotifyAccountService,
  createSpotifyAuthorizationService,
  disconnectSpotifyAccountService,
  getSpotifyAccountsService,
  SpotifyCredentialNotFoundError,
  SpotifyCredentialUnavailableError,
} from "../../spotify/account";
import {
  getSpotifyNowPlayingService,
  getSpotifyPlaylistService,
} from "../../spotify/playback";
import { adminGuard } from "../guards/admin.guard";
import { callerGuard, tieredRateLimitGuard } from "../guards/caller.guard";
import { rateLimitGuard } from "../guards/rate-limit.guard";
import { contractOS } from "../utils";

export const getSpotifyPlaylistRoute = contractOS.spotify.playlist
  .use(
    callerGuard({
      minTier: CallerTier.ApiKey,
      scopes: [ApiKeyScope.SpotifyRead],
    })
  )
  .use(tieredRateLimitGuard({ prefix: "rate-limiter:spotify" }))
  .handler(async (opts) => {
    return await getSpotifyPlaylistService(opts.input.playlistId);
  });

export const getSpotifyNowPlayingRoute = contractOS.spotify.playing
  .use(rateLimitGuard({ prefix: "rate-limiter:spotify" }))
  .handler(async (opts) => {
    try {
      return await getSpotifyNowPlayingService(opts.context.db);
    } catch (error) {
      // Unconfigured (no account, no fallback refresh token) is 503, not a crash.
      if (error instanceof SpotifyCredentialUnavailableError) {
        throw opts.errors.SERVICE_UNAVAILABLE();
      }
      throw error;
    }
  });

/** Any admin/root may manage connected Spotify accounts; not pinned to the configured admin id. */
const spotifyManageGuard = adminGuard({ pinToAdminId: false });

export const getSpotifyAccountsRoute = contractOS.spotify.accounts
  .use(spotifyManageGuard)
  .handler(async (opts) => {
    return getSpotifyAccountsService(
      opts.context.db,
      opts.context.session.user.id
    );
  });

export const createSpotifyAuthorizationRoute = contractOS.spotify.authorize
  .use(spotifyManageGuard)
  .handler(async (opts) => {
    if (!opts.context.kv) {
      throw opts.errors.SERVICE_UNAVAILABLE();
    }

    try {
      const url = await createSpotifyAuthorizationService(
        opts.context.kv,
        opts.context.session.user.id
      );
      return { url };
    } catch (err) {
      if (err instanceof SpotifyCredentialUnavailableError) {
        throw opts.errors.SERVICE_UNAVAILABLE();
      }
      throw err;
    }
  });

export const activateSpotifyAccountRoute = contractOS.spotify.activate
  .use(spotifyManageGuard)
  .handler(async (opts) => {
    try {
      return await activateSpotifyAccountService(
        opts.context.db,
        opts.input.userId
      );
    } catch (err) {
      if (err instanceof SpotifyCredentialNotFoundError) {
        throw opts.errors.NOT_FOUND();
      }
      throw err;
    }
  });

export const disconnectSpotifyAccountRoute = contractOS.spotify.disconnect
  .use(spotifyManageGuard)
  .handler(async (opts) => {
    await disconnectSpotifyAccountService(
      opts.context.db,
      opts.context.session.user.id
    );
  });
