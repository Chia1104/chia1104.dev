import { randomBytes } from "node:crypto";

import type { DB } from "@chia/db";
import {
  deleteSpotifyCredential,
  getActiveSpotifyCredential,
  getSpotifyCredentialByUserId,
  listSpotifyCredentials,
  setActiveSpotifyCredential,
  upsertSpotifyCredential,
} from "@chia/db/repos/spotify";
import type { Keyv } from "@chia/kv";

import { env } from "./env";
import type { SpotifyOAuthCallbackDTO } from "./validator";

import {
  codeAuthorization,
  decryptSpotifyToken,
  encryptSpotifyToken,
  generateAuthorizeUrl,
  getSpotifyUserProfile,
} from "./index";

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
