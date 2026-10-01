const mocks = vi.hoisted(() => {
  class SpotifyCredentialUnavailableError extends Error {}

  return {
    SpotifyCredentialUnavailableError,
    completeSpotifyAuthorizationService: vi.fn(),
    getSpotifyNowPlayingService: vi.fn(),
    getSpotifyPlaylistService: vi.fn(),
  };
});

vi.mock("@chia/services/spotify/account.service", () => ({
  SpotifyCredentialUnavailableError: mocks.SpotifyCredentialUnavailableError,
  completeSpotifyAuthorizationService:
    mocks.completeSpotifyAuthorizationService,
}));

vi.mock("../src/services/spotify.service", () => ({
  getSpotifyDashboardRedirect: (status: string) =>
    `http://localhost:3001/settings/spotify?spotify=${status}`,
}));

// `playlist` requires the API key; only `apps/www`'s server client reads it.
vi.mock("@chia/services/spotify/playback.service", () => ({
  getSpotifyNowPlayingService: mocks.getSpotifyNowPlayingService,
  getSpotifyPlaylistService: mocks.getSpotifyPlaylistService,
}));

import { beforeEach, describe, expect, it, vi } from "vitest";

import { CallerTier } from "@chia/auth/tier";

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
      track: {
        name: "Song",
        url: "https://open.spotify.com/track/1",
        artists: ["Artist"],
        album: "Album",
        imageUrl: null,
        durationMs: 200_000,
      },
      isPlaying: true,
      progressMs: 60_000,
      observedAt: 1_000_000,
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
        expect.anything(),
        expect.anything()
      );
    });

    it("serves GET as a shared read any origin may cache", async () => {
      const res = await app.request("/api/v1/rpc/spotify/playing", {
        headers: { Origin: "http://localhost:3000" },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("cdn-cache-control")).toContain("max-age=");
      expect(res.headers.get("cache-control")).toBe("no-cache");
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      expect(res.headers.get("access-control-allow-credentials")).toBeNull();
    });

    it("leaves POST responses uncached", async () => {
      const res = await playing();

      expect(res.headers.get("cdn-cache-control")).toBeNull();
    });

    it("does not cache a failed GET", async () => {
      mocks.getSpotifyNowPlayingService.mockRejectedValueOnce(
        new mocks.SpotifyCredentialUnavailableError()
      );

      const res = await app.request("/api/v1/rpc/spotify/playing");

      expect(res.status).toBe(503);
      expect(res.headers.get("cdn-cache-control")).toBeNull();
      expect(res.headers.get("cache-control")).toBeNull();
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

    it("does not answer GET, which only shared reads accept", async () => {
      const res = await app.request(
        `/api/v1/rpc/spotify/playlist?data=${encodeURIComponent(
          JSON.stringify({ json: { playlistId: "default" } })
        )}`
      );

      expect(res.status).toBe(404);
      expect(mocks.getSpotifyPlaylistService).not.toHaveBeenCalled();
    });

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
