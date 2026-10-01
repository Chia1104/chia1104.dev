import type Keyv from "keyv";
import { HTTPError } from "ky";

import type { DB } from "@chia/db/client";
import {
  getActiveSpotifyCredential,
  withLockedSpotifyCredential,
} from "@chia/db/repos/spotify";
import {
  decryptSpotifyToken,
  encryptSpotifyToken,
  getNowPlaying,
  getPlayList,
  refreshSpotifyAccessToken,
} from "@chia/integrations/spotify";
import { env } from "@chia/integrations/spotify/env";
import type { CurrentPlaying } from "@chia/integrations/spotify/types";
import { logger } from "@chia/observability/logger";

import { SpotifyCredentialUnavailableError } from "./account.service";
import type { SpotifyNowPlaying } from "./spotify.contract";

const ACCESS_TOKEN_EXPIRY_BUFFER_MS = 60_000;

const NOW_PLAYING_CACHE_KEY = "spotify:now-playing";
const NOW_PLAYING_CACHE_TTL_MS = 10_000;

interface CachedNowPlaying {
  nowPlaying: SpotifyNowPlaying;
}

const isAccessTokenUsable = (expiresAt: Date) => {
  return expiresAt.getTime() - ACCESS_TOKEN_EXPIRY_BUFFER_MS > Date.now();
};

const isUnauthorizedError = (cause: unknown) => {
  return cause instanceof HTTPError && cause.response.status === 401;
};

const resolveFallbackAccessToken = async (): Promise<string | undefined> => {
  if (!env.SPOTIFY_REFRESH_TOKEN) {
    return undefined;
  }

  const token = await refreshSpotifyAccessToken(env.SPOTIFY_REFRESH_TOKEN);
  return token.access_token;
};

export const resolveSpotifyAccessToken = async (
  db: DB,
  options?: {
    /**
     * Skip the expiry check and exchange a new access token immediately.
     * Used when Spotify rejects a stored token before its expected expiry
     * (e.g. the user revoked the app's access).
     */
    forceRefresh?: boolean;
  }
): Promise<string | undefined> => {
  const activeCredential = await getActiveSpotifyCredential(db);

  if (!activeCredential) {
    return resolveFallbackAccessToken();
  }

  if (
    !options?.forceRefresh &&
    isAccessTokenUsable(activeCredential.accessTokenExpiresAt)
  ) {
    return decryptSpotifyToken(activeCredential.accessToken);
  }

  const accessToken = await withLockedSpotifyCredential(
    db,
    activeCredential.userId,
    async (lockedCredential, updateTokens) => {
      if (!lockedCredential.isActive) {
        return undefined;
      }

      if (
        !options?.forceRefresh &&
        isAccessTokenUsable(lockedCredential.accessTokenExpiresAt)
      ) {
        return decryptSpotifyToken(lockedCredential.accessToken);
      }

      const currentRefreshToken = decryptSpotifyToken(
        lockedCredential.refreshToken
      );
      const refreshedToken =
        await refreshSpotifyAccessToken(currentRefreshToken);
      const refreshToken = refreshedToken.refresh_token ?? currentRefreshToken;

      await updateTokens({
        accessToken: encryptSpotifyToken(refreshedToken.access_token),
        refreshToken: encryptSpotifyToken(refreshToken),
        accessTokenExpiresAt: new Date(
          Date.now() + refreshedToken.expires_in * 1000
        ),
        scope: refreshedToken.scope || lockedCredential.scope,
      });

      return refreshedToken.access_token;
    }
  );

  return accessToken ?? resolveSpotifyAccessToken(db, options);
};

export const getSpotifyPlaylistService = (playlistId: string) => {
  return getPlayList({
    playlistId: playlistId === "default" ? undefined : playlistId,
  });
};

const fetchNowPlaying = async (db: DB) => {
  const accessToken = await resolveSpotifyAccessToken(db);
  if (!accessToken) {
    throw new SpotifyCredentialUnavailableError();
  }

  try {
    return await getNowPlaying({ accessToken });
  } catch (err) {
    // A 401 before the expected expiry means the token was revoked;
    // force one refresh and retry before giving up.
    if (!isUnauthorizedError(err)) {
      throw err;
    }

    const refreshedAccessToken = await resolveSpotifyAccessToken(db, {
      forceRefresh: true,
    }).catch((cause) => {
      logger.warn({ err: cause }, "Spotify token refresh failed after a 401");
      return undefined;
    });

    if (!refreshedAccessToken) {
      throw new SpotifyCredentialUnavailableError();
    }

    return getNowPlaying({ accessToken: refreshedAccessToken });
  }
};

const toNowPlaying = (
  playing: CurrentPlaying | null,
  observedAt: number
): SpotifyNowPlaying => {
  // Spotify sends a null `item` for ads and podcasts, which the payload type does not model.
  if (!playing?.item) {
    return null;
  }

  const { item } = playing;
  return {
    track: {
      name: item.name,
      url: item.external_urls.spotify,
      artists: item.artists.map((artist) => artist.name),
      album: item.album.name,
      imageUrl: item.album.images[0]?.url ?? null,
      durationMs: item.duration_ms,
    },
    isPlaying: playing.is_playing,
    progressMs: playing.progress_ms,
    observedAt,
  };
};

/** Stale even inside the TTL, or the reader's end-of-track refetch would get the same track back. */
const hasEnded = (nowPlaying: SpotifyNowPlaying) =>
  !!nowPlaying?.isPlaying &&
  nowPlaying.observedAt - nowPlaying.progressMs + nowPlaying.track.durationMs <=
    Date.now();

/** Visitors share one Spotify call per cache window. */
export const getSpotifyNowPlayingService = async (
  db: DB,
  kv: Keyv
): Promise<SpotifyNowPlaying> => {
  const cached = await kv.get<CachedNowPlaying>(NOW_PLAYING_CACHE_KEY);
  if (cached && !hasEnded(cached.nowPlaying)) {
    return cached.nowPlaying;
  }

  const nowPlaying = toNowPlaying(await fetchNowPlaying(db), Date.now());
  await kv.set<CachedNowPlaying>(
    NOW_PLAYING_CACHE_KEY,
    { nowPlaying },
    NOW_PLAYING_CACHE_TTL_MS
  );
  return nowPlaying;
};
