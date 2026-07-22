const mocks = vi.hoisted(() => {
  class SpotifyCredentialUnavailableError extends Error {}
  class SpotifyCredentialNotFoundError extends Error {}

  return {
    SpotifyCredentialUnavailableError,
    SpotifyCredentialNotFoundError,
    activateSpotifyAccountService: vi.fn(),
    completeSpotifyAuthorizationService: vi.fn(),
    createSpotifyAuthorizationService: vi.fn(),
    disconnectSpotifyAccountService: vi.fn(),
    getSpotifyAccountsService: vi.fn(),
    getSpotifyNowPlayingService: vi.fn(),
    getSpotifyPlaylistService: vi.fn(),
  };
});

vi.mock("../src/services/spotify.service", () => ({
  SpotifyCredentialUnavailableError: mocks.SpotifyCredentialUnavailableError,
  SpotifyCredentialNotFoundError: mocks.SpotifyCredentialNotFoundError,
  activateSpotifyAccountService: mocks.activateSpotifyAccountService,
  completeSpotifyAuthorizationService:
    mocks.completeSpotifyAuthorizationService,
  createSpotifyAuthorizationService: mocks.createSpotifyAuthorizationService,
  disconnectSpotifyAccountService: mocks.disconnectSpotifyAccountService,
  getSpotifyAccountsService: mocks.getSpotifyAccountsService,
  getSpotifyDashboardRedirect: (status: string) =>
    `http://localhost:3001/settings/spotify?spotify=${status}`,
  getSpotifyNowPlayingService: mocks.getSpotifyNowPlayingService,
  getSpotifyPlaylistService: mocks.getSpotifyPlaylistService,
}));

import { app } from "../src/server";

describe("Spotify Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSpotifyPlaylistService.mockResolvedValue({
      id: "playlist-id",
    });
    mocks.getSpotifyNowPlayingService.mockResolvedValue({
      is_playing: true,
    });
    mocks.getSpotifyAccountsService.mockResolvedValue({
      currentUserId: "test-user-id",
      accounts: [],
    });
    mocks.activateSpotifyAccountService.mockResolvedValue({
      userId: "test-user-id",
      isActive: true,
    });
    mocks.createSpotifyAuthorizationService.mockResolvedValue(
      "https://accounts.spotify.com/authorize?state=state"
    );
    mocks.completeSpotifyAuthorizationService.mockResolvedValue("connected");
  });

  describe("GET /api/v1/spotify/playing", () => {
    it("returns the current playback from the service", async () => {
      const res = await app.request("/api/v1/spotify/playing");

      expect(res.status).toBe(200);
      expect(mocks.getSpotifyNowPlayingService).toHaveBeenCalledWith(
        expect.anything()
      );
    });

    it("returns 503 when no active or fallback credential exists", async () => {
      mocks.getSpotifyNowPlayingService.mockRejectedValueOnce(
        new mocks.SpotifyCredentialUnavailableError()
      );

      const res = await app.request("/api/v1/spotify/playing");

      expect(res.status).toBe(503);
    });
  });

  describe("GET /api/v1/spotify/playlist/:id", () => {
    it("should return response from default playlist", async () => {
      const res = await app.request("/api/v1/spotify/playlist/default");

      expect(res.status).toBe(200);
      expect(mocks.getSpotifyPlaylistService).toHaveBeenCalledWith("default");
    });

    it("should handle playlist ID parameter", async () => {
      const res = await app.request("/api/v1/spotify/playlist/test-id");

      expect(res.status).toBe(200);
      expect(mocks.getSpotifyPlaylistService).toHaveBeenCalledWith("test-id");
    });
  });

  describe("Spotify account management", () => {
    it("returns safe connected account metadata", async () => {
      mocks.getSpotifyAccountsService.mockResolvedValueOnce({
        currentUserId: "test-user-id",
        accounts: [
          {
            userId: "test-user-id",
            spotifyDisplayName: "Spotify User",
            isActive: true,
          },
        ],
      });

      const res = await app.request("/api/v1/spotify/manage/accounts");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toMatchObject({
        currentUserId: "test-user-id",
        accounts: [
          {
            spotifyDisplayName: "Spotify User",
            isActive: true,
          },
        ],
      });
      expect(JSON.stringify(body)).not.toContain("access-token");
      expect(JSON.stringify(body)).not.toContain("refresh-token");
    });

    it("switches the active playback account", async () => {
      const res = await app.request(
        "/api/v1/spotify/manage/accounts/another-admin/activate",
        {
          method: "POST",
        }
      );

      expect(res.status).toBe(200);
      expect(mocks.activateSpotifyAccountService).toHaveBeenCalledWith(
        expect.anything(),
        "another-admin"
      );
    });

    it("passes validated OAuth callback queries to the service", async () => {
      const authorizeRes = await app.request(
        "/api/v1/spotify/manage/authorize",
        {
          method: "POST",
        }
      );
      expect(authorizeRes.status).toBe(200);

      const callbackPath =
        "/api/v1/spotify/oauth/callback?code=code&state=state";
      const callbackRes = await app.request(callbackPath);

      expect(callbackRes.status).toBe(302);
      expect(callbackRes.headers.get("location")).toContain(
        "spotify=connected"
      );
      expect(mocks.completeSpotifyAuthorizationService).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        {
          code: "code",
          state: "state",
        }
      );
    });

    it("redirects invalid callback queries before calling the service", async () => {
      const res = await app.request("/api/v1/spotify/oauth/callback?code=code");

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toContain("spotify=invalid_callback");
      expect(mocks.completeSpotifyAuthorizationService).not.toHaveBeenCalled();
    });

    it("accepts the OAuth error branch from the union schema", async () => {
      mocks.completeSpotifyAuthorizationService.mockResolvedValueOnce(
        "cancelled"
      );

      const res = await app.request(
        "/api/v1/spotify/oauth/callback?error=access_denied&state=state"
      );

      expect(res.status).toBe(302);
      expect(mocks.completeSpotifyAuthorizationService).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        {
          error: "access_denied",
          state: "state",
        }
      );
    });
  });
});
