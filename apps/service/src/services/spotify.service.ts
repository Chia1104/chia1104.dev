import { randomBytes } from "node:crypto";

import { HTTPError } from "ky";

import {
  codeAuthorization,
  decryptSpotifyToken,
  encryptSpotifyToken,
  generateAuthorizeUrl,
  getNowPlaying,
  getPlayList,
  getSpotifyUserProfile,
  refreshSpotifyAccessToken,
} from "@chia/api/spotify";
import type { SpotifyOAuthCallbackDTO } from "@chia/api/spotify/validator";
import type { DB } from "@chia/db";
import {
  deleteSpotifyCredential,
  getActiveSpotifyCredential,
  getSpotifyCredentialByUserId,
  listSpotifyCredentials,
  setActiveSpotifyCredential,
  upsertSpotifyCredential,
  withLockedSpotifyCredential,
} from "@chia/db/repos/spotify";
import type { Keyv } from "@chia/kv";
import { DASH_BASE_URL } from "@chia/utils/config";

import { env } from "../env";

const ACCESS_TOKEN_EXPIRY_BUFFER_MS = 60_000;
const SPOTIFY_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const SPOTIFY_OAUTH_STATE_PREFIX = "spotify:oauth:state:";
const SPOTIFY_SCOPES = ["user-read-currently-playing"];

interface SpotifyOAuthState {
  userId: string;
}

export class SpotifyCredentialUnavailableError extends Error {
  constructor() {
    super("No active Spotify credential is available");
    this.name = "SpotifyCredentialUnavailableError";
  }
}

export class SpotifyCredentialNotFoundError extends Error {
  constructor() {
    super("Spotify credential was not found");
    this.name = "SpotifyCredentialNotFoundError";
  }
}

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

export const getSpotifyAccountsService = async (
  db: DB,
  currentUserId: string
) => {
  const accounts = await listSpotifyCredentials(db);
  return {
    currentUserId,
    accounts: accounts.map((account) => ({
      ...account,
      accessTokenExpiresAt: account.accessTokenExpiresAt.toISOString(),
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    })),
  };
};

export const createSpotifyAuthorizationService = async (
  kv: Keyv,
  userId: string
) => {
  const state = randomBytes(32).toString("base64url");
  await kv.set<SpotifyOAuthState>(
    `${SPOTIFY_OAUTH_STATE_PREFIX}${state}`,
    { userId },
    SPOTIFY_OAUTH_STATE_TTL_MS
  );

  if (!env.SPOTIFY_REDIRECT_URI) {
    throw new SpotifyCredentialUnavailableError();
  }

  return generateAuthorizeUrl({
    state,
    scopes: SPOTIFY_SCOPES,
    redirectUri: env.SPOTIFY_REDIRECT_URI,
  });
};

export const completeSpotifyAuthorizationService = async (
  db: DB,
  kv: Keyv,
  query: SpotifyOAuthCallbackDTO
) => {
  const stateKey = `${SPOTIFY_OAUTH_STATE_PREFIX}${query.state}`;
  const state = await kv.get<SpotifyOAuthState>(stateKey);
  await kv.delete(stateKey);

  if (!state) {
    return "invalid_state" as const;
  }
  if ("error" in query) {
    return "cancelled" as const;
  }

  if (!env.SPOTIFY_REDIRECT_URI) {
    throw new SpotifyCredentialUnavailableError();
  }

  const token = await codeAuthorization({
    code: query.code,
    state: query.state,
    redirectUri: env.SPOTIFY_REDIRECT_URI,
  });
  const existingCredential = await getSpotifyCredentialByUserId(
    db,
    state.userId
  );
  const refreshToken =
    token.refresh_token ??
    (existingCredential
      ? decryptSpotifyToken(existingCredential.refreshToken)
      : undefined);

  if (!refreshToken) {
    throw new Error("Spotify did not return a refresh token");
  }

  const profile = await getSpotifyUserProfile(token.access_token);
  await upsertSpotifyCredential(db, {
    userId: state.userId,
    spotifyUserId: profile.id,
    spotifyDisplayName: profile.display_name,
    spotifyImageUrl: profile.images[0]?.url,
    accessToken: encryptSpotifyToken(token.access_token),
    refreshToken: encryptSpotifyToken(refreshToken),
    accessTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
    scope: token.scope,
  });

  const activeCredential = await getActiveSpotifyCredential(db);
  if (!activeCredential) {
    await setActiveSpotifyCredential(db, state.userId);
  }

  return "connected" as const;
};

export const activateSpotifyAccountService = async (db: DB, userId: string) => {
  const credential = await setActiveSpotifyCredential(db, userId);
  if (!credential) {
    throw new SpotifyCredentialNotFoundError();
  }

  return {
    userId: credential.userId,
    isActive: credential.isActive,
  };
};

export const disconnectSpotifyAccountService = (db: DB, userId: string) => {
  return deleteSpotifyCredential(db, userId);
};
