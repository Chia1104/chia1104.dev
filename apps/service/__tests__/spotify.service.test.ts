const mocks = vi.hoisted(() => ({
  codeAuthorization: vi.fn(),
  decryptSpotifyToken: vi.fn((value: string) =>
    value.replace(/^encrypted:/, "")
  ),
  encryptSpotifyToken: vi.fn((value: string) => `encrypted:${value}`),
  generateAuthorizeUrl: vi.fn(
    ({ state }: { state: string }) =>
      `https://accounts.spotify.com/authorize?state=${state}`
  ),
  getNowPlaying: vi.fn(),
  getPlayList: vi.fn(),
  getSpotifyUserProfile: vi.fn(),
  refreshSpotifyAccessToken: vi.fn(),
  deleteSpotifyCredential: vi.fn(),
  getActiveSpotifyCredential: vi.fn(),
  getSpotifyCredentialByUserId: vi.fn(),
  listSpotifyCredentials: vi.fn(),
  setActiveSpotifyCredential: vi.fn(),
  upsertSpotifyCredential: vi.fn(),
  withLockedSpotifyCredential: vi.fn(),
}));

vi.mock("@chia/api/spotify", () => ({
  codeAuthorization: mocks.codeAuthorization,
  decryptSpotifyToken: mocks.decryptSpotifyToken,
  encryptSpotifyToken: mocks.encryptSpotifyToken,
  generateAuthorizeUrl: mocks.generateAuthorizeUrl,
  getNowPlaying: mocks.getNowPlaying,
  getPlayList: mocks.getPlayList,
  getSpotifyUserProfile: mocks.getSpotifyUserProfile,
  refreshSpotifyAccessToken: mocks.refreshSpotifyAccessToken,
}));

vi.mock("@chia/db/repos/spotify", () => ({
  deleteSpotifyCredential: mocks.deleteSpotifyCredential,
  getActiveSpotifyCredential: mocks.getActiveSpotifyCredential,
  getSpotifyCredentialByUserId: mocks.getSpotifyCredentialByUserId,
  listSpotifyCredentials: mocks.listSpotifyCredentials,
  setActiveSpotifyCredential: mocks.setActiveSpotifyCredential,
  upsertSpotifyCredential: mocks.upsertSpotifyCredential,
  withLockedSpotifyCredential: mocks.withLockedSpotifyCredential,
}));

import { HTTPError } from "ky";

import type { DB } from "@chia/db";
import type { Keyv } from "@chia/kv";

import {
  completeSpotifyAuthorizationService,
  createSpotifyAuthorizationService,
  getSpotifyNowPlayingService,
  resolveSpotifyAccessToken,
  SpotifyCredentialUnavailableError,
} from "../src/services/spotify.service";

const db = {} as DB;

const createCredential = (expiresAt: Date) => ({
  userId: "admin-id",
  spotifyUserId: "spotify-id",
  spotifyDisplayName: "Spotify User",
  spotifyImageUrl: null,
  accessToken: "encrypted:stored-access-token",
  refreshToken: "encrypted:stored-refresh-token",
  accessTokenExpiresAt: expiresAt,
  scope: "user-read-currently-playing",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("Spotify token resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSpotifyCredentialByUserId.mockResolvedValue(undefined);
    mocks.getActiveSpotifyCredential.mockResolvedValue(undefined);
    mocks.setActiveSpotifyCredential.mockResolvedValue({
      userId: "admin-id",
      isActive: true,
    });
    mocks.codeAuthorization.mockResolvedValue({
      access_token: "access-token",
      refresh_token: "refresh-token",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "user-read-currently-playing",
    });
    mocks.getSpotifyUserProfile.mockResolvedValue({
      id: "spotify-id",
      display_name: "Spotify User",
      images: [],
    });
  });

  it("reuses an access token that is not close to expiry", async () => {
    mocks.getActiveSpotifyCredential.mockResolvedValueOnce(
      createCredential(new Date(Date.now() + 10 * 60 * 1000))
    );

    await expect(resolveSpotifyAccessToken(db)).resolves.toBe(
      "stored-access-token"
    );
    expect(mocks.withLockedSpotifyCredential).not.toHaveBeenCalled();
    expect(mocks.refreshSpotifyAccessToken).not.toHaveBeenCalled();
  });

  it("refreshes an expired token while preserving an omitted refresh token", async () => {
    const credential = createCredential(new Date(Date.now() - 1000));
    const updateTokens = vi.fn();
    mocks.getActiveSpotifyCredential.mockResolvedValueOnce(credential);
    mocks.withLockedSpotifyCredential.mockImplementationOnce(
      async (_db, _userId, handler) => {
        return handler(credential, updateTokens);
      }
    );
    mocks.refreshSpotifyAccessToken.mockResolvedValueOnce({
      access_token: "refreshed-access-token",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "user-read-currently-playing",
    });

    await expect(resolveSpotifyAccessToken(db)).resolves.toBe(
      "refreshed-access-token"
    );
    expect(mocks.refreshSpotifyAccessToken).toHaveBeenCalledWith(
      "stored-refresh-token"
    );
    expect(updateTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "encrypted:refreshed-access-token",
        refreshToken: "encrypted:stored-refresh-token",
      })
    );
  });

  it("uses the deprecated env fallback when no active account exists", async () => {
    mocks.getActiveSpotifyCredential.mockResolvedValueOnce(undefined);
    mocks.refreshSpotifyAccessToken.mockResolvedValueOnce({
      access_token: "fallback-access-token",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "user-read-currently-playing",
    });

    await expect(resolveSpotifyAccessToken(db)).resolves.toBe(
      "fallback-access-token"
    );
    expect(mocks.refreshSpotifyAccessToken).toHaveBeenCalledWith(
      "test-spotify-refresh-token"
    );
  });
});

describe("Spotify now playing service", () => {
  const createHTTPError = (status: number, statusText: string) => {
    return new HTTPError(
      new Response(null, { status, statusText }),
      new Request("https://api.spotify.com/v1/me/player/currently-playing"),
      {} as never
    );
  };
  const unauthorizedError = createHTTPError(401, "Unauthorized");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forces a refresh and retries when the stored token was revoked", async () => {
    const credential = createCredential(new Date(Date.now() + 10 * 60 * 1000));
    const updateTokens = vi.fn();
    mocks.getActiveSpotifyCredential.mockResolvedValue(credential);
    mocks.withLockedSpotifyCredential.mockImplementation(
      async (_db, _userId, handler) => {
        return handler(credential, updateTokens);
      }
    );
    mocks.refreshSpotifyAccessToken.mockResolvedValueOnce({
      access_token: "refreshed-access-token",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "user-read-currently-playing",
    });
    mocks.getNowPlaying
      .mockRejectedValueOnce(unauthorizedError)
      .mockResolvedValueOnce({ is_playing: true });

    await expect(getSpotifyNowPlayingService(db)).resolves.toEqual({
      is_playing: true,
    });
    expect(mocks.getNowPlaying).toHaveBeenNthCalledWith(1, {
      accessToken: "stored-access-token",
    });
    expect(mocks.getNowPlaying).toHaveBeenNthCalledWith(2, {
      accessToken: "refreshed-access-token",
    });
    expect(mocks.refreshSpotifyAccessToken).toHaveBeenCalledWith(
      "stored-refresh-token"
    );
  });

  it("reports the credential unavailable when the forced refresh fails", async () => {
    const credential = createCredential(new Date(Date.now() + 10 * 60 * 1000));
    mocks.getActiveSpotifyCredential.mockResolvedValue(credential);
    mocks.withLockedSpotifyCredential.mockImplementation(
      async (_db, _userId, handler) => {
        return handler(credential, vi.fn());
      }
    );
    mocks.refreshSpotifyAccessToken.mockRejectedValue(
      new Error("invalid_grant")
    );
    mocks.getNowPlaying.mockRejectedValueOnce(unauthorizedError);

    await expect(getSpotifyNowPlayingService(db)).rejects.toBeInstanceOf(
      SpotifyCredentialUnavailableError
    );
  });

  it("rethrows non-401 errors without refreshing", async () => {
    const credential = createCredential(new Date(Date.now() + 10 * 60 * 1000));
    mocks.getActiveSpotifyCredential.mockResolvedValue(credential);
    mocks.getNowPlaying.mockRejectedValueOnce(
      createHTTPError(500, "Internal Server Error")
    );

    await expect(getSpotifyNowPlayingService(db)).rejects.toThrow(
      "500 Internal Server Error"
    );
    expect(mocks.refreshSpotifyAccessToken).not.toHaveBeenCalled();
  });
});

describe("Spotify authorization service", () => {
  const store = new Map<string, unknown>();
  const kv = {
    get: vi.fn((key: string) => store.get(key)),
    set: vi.fn((key: string, value: unknown) => {
      store.set(key, value);
      return true;
    }),
    delete: vi.fn((key: string) => store.delete(key)),
  } as unknown as Keyv;

  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
    mocks.getSpotifyCredentialByUserId.mockResolvedValue(undefined);
    mocks.getActiveSpotifyCredential.mockResolvedValue(undefined);
    mocks.codeAuthorization.mockResolvedValue({
      access_token: "access-token",
      refresh_token: "refresh-token",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "user-read-currently-playing",
    });
    mocks.getSpotifyUserProfile.mockResolvedValue({
      id: "spotify-id",
      display_name: "Spotify User",
      images: [],
    });
  });

  it("stores and consumes OAuth state exactly once", async () => {
    const url = await createSpotifyAuthorizationService(kv, "admin-id");
    const state = new URL(url).searchParams.get("state");

    expect(state).toBeTruthy();

    const query = {
      code: "authorization-code",
      state: state!,
    };
    await expect(
      completeSpotifyAuthorizationService(db, kv, query)
    ).resolves.toBe("connected");
    expect(mocks.upsertSpotifyCredential).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        userId: "admin-id",
        spotifyUserId: "spotify-id",
        accessToken: "encrypted:access-token",
        refreshToken: "encrypted:refresh-token",
      })
    );

    await expect(
      completeSpotifyAuthorizationService(db, kv, query)
    ).resolves.toBe("invalid_state");
    expect(mocks.codeAuthorization).toHaveBeenCalledTimes(1);
  });

  it("handles the OAuth error branch from the union schema", async () => {
    const url = await createSpotifyAuthorizationService(kv, "admin-id");
    const state = new URL(url).searchParams.get("state");

    await expect(
      completeSpotifyAuthorizationService(db, kv, {
        error: "access_denied",
        state: state!,
      })
    ).resolves.toBe("cancelled");
    expect(mocks.codeAuthorization).not.toHaveBeenCalled();
  });
});
