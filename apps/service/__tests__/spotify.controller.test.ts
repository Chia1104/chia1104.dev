const mocks = vi.hoisted(() => {
  class SpotifyCredentialUnavailableError extends Error {}

  return {
    SpotifyCredentialUnavailableError,
    completeSpotifyAuthorizationService: vi.fn(),
    getSpotifyNowPlayingService: vi.fn(),
    getSpotifyPlaylistService: vi.fn(),
  };
});

vi.mock("@chia/api/spotify/account", () => ({
  SpotifyCredentialUnavailableError: mocks.SpotifyCredentialUnavailableError,
  completeSpotifyAuthorizationService:
    mocks.completeSpotifyAuthorizationService,
}));

vi.mock("../src/services/spotify.service", () => ({
  getSpotifyDashboardRedirect: (status: string) =>
    `http://localhost:3001/settings/spotify?spotify=${status}`,
}));

// `playlist` requires the API key; only `apps/www`'s server client reads it.
vi.mock("@chia/api/spotify/playback", () => ({
  getSpotifyNowPlayingService: mocks.getSpotifyNowPlayingService,
  getSpotifyPlaylistService: mocks.getSpotifyPlaylistService,
}));

import { beforeEach, describe, expect, it, vi } from "vitest";

import { CallerTier } from "@chia/service-kit/policies/caller.policy";

import { app } from "../src/server";

import * as guardMocks from "./helpers/guards";

const playlist = (playlistId: string) =>
  app.request("/api/v1/rpc/spotify/playlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: { playlistId } }),
  });

describe("Spotify Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardMocks.resetAllGuardMocks();
    mocks.getSpotifyPlaylistService.mockResolvedValue({
      id: "playlist-id",
    });
    mocks.getSpotifyNowPlayingService.mockResolvedValue({
      is_playing: true,
    });
    mocks.completeSpotifyAuthorizationService.mockResolvedValue("connected");
  });

  describe("spotify.playing", () => {
    const playing = () =>
      app.request("/api/v1/rpc/spotify/playing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

    it("returns the current playback from the service", async () => {
      const res = await playing();

      expect(res.status).toBe(200);
      expect(mocks.getSpotifyNowPlayingService).toHaveBeenCalledWith(
        expect.anything()
      );
    });

    it("returns 503 when no active or fallback credential exists", async () => {
      mocks.getSpotifyNowPlayingService.mockRejectedValueOnce(
        new mocks.SpotifyCredentialUnavailableError()
      );

      const res = await playing();

      expect(res.status).toBe(503);
    });
  });

  describe("spotify.playlist", () => {
    beforeEach(() => guardMocks.setCallerTier(CallerTier.ApiKey));

    it("returns the default playlist", async () => {
      const res = await playlist("default");

      expect(res.status).toBe(200);
      expect(mocks.getSpotifyPlaylistService).toHaveBeenCalledWith("default");
    });

    it("forwards the playlist ID", async () => {
      const res = await playlist("test-id");

      expect(res.status).toBe(200);
      expect(mocks.getSpotifyPlaylistService).toHaveBeenCalledWith("test-id");
    });

    it("rejects an anonymous caller", async () => {
      guardMocks.setCallerTier(CallerTier.Anonymous);

      const res = await playlist("default");

      expect(res.status).toBe(401);
      expect(mocks.getSpotifyPlaylistService).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/v1/spotify/oauth/callback", () => {
    it("passes validated OAuth callback queries to the service", async () => {
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
