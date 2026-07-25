import { SpotifyCredentialUnavailableError } from "../../spotify/account";
import {
  getSpotifyNowPlayingService,
  getSpotifyPlaylistService,
} from "../../spotify/playback";
import { rateLimitGuard } from "../guards/rate-limit.guard";
import { contractOS } from "../utils";

export const getSpotifyPlaylistRoute = contractOS.media.spotify.playlist
  .use(rateLimitGuard({ prefix: "rate-limiter:spotify" }))
  .handler(async (opts) => {
    return await getSpotifyPlaylistService(opts.input.playlistId);
  });

export const getSpotifyNowPlayingRoute = contractOS.media.spotify.playing
  .use(rateLimitGuard({ prefix: "rate-limiter:spotify" }))
  .handler(async (opts) => {
    try {
      return await getSpotifyNowPlayingService(opts.context.db);
    } catch (error) {
      // No connected account and no fallback refresh token — the feature is simply
      // unconfigured, which is a 503 rather than a crash.
      if (error instanceof SpotifyCredentialUnavailableError) {
        throw opts.errors.SERVICE_UNAVAILABLE();
      }
      throw error;
    }
  });
