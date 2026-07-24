import { HTTPError } from "ky";

import {
  decryptSpotifyToken,
  encryptSpotifyToken,
  getNowPlaying,
  getPlayList,
  refreshSpotifyAccessToken,
} from "@chia/api/spotify";
import { SpotifyCredentialUnavailableError } from "@chia/api/spotify/account";
import type { DB } from "@chia/db";
import {
  getActiveSpotifyCredential,
  withLockedSpotifyCredential,
} from "@chia/db/repos/spotify";
import { DASH_BASE_URL } from "@chia/utils/config";

import { env } from "../env";

const ACCESS_TOKEN_EXPIRY_BUFFER_MS = 60_000;

export const getSpotifyDashboardRedirect = (status: string) => {
  const url = new URL("/settings/spotify", DASH_BASE_URL);
  url.searchParams.set("spotify", status);
  return url.toString();
};

const isAccessTokenUsable = (expiresAt: Date) => {
  return expiresAt.getTime() - ACCESS_TOKEN_EXPIRY_BUFFER_MS > Date.now();
};

const isUnauthorizedError = (error: unknown) => {
  return error instanceof HTTPError && error.response.status === 401;
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

export const getSpotifyNowPlayingService = async (db: DB) => {
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
    }).catch(() => undefined);

    if (!refreshedAccessToken) {
      throw new SpotifyCredentialUnavailableError();
    }

    return getNowPlaying({ accessToken: refreshedAccessToken });
  }
};
