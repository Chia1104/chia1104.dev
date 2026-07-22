import {
  codeAuthorization,
  decryptSpotifyToken,
  encryptSpotifyToken,
  generateAuthorizeUrl,
  getNowPlaying,
  getSpotifyAccessToken,
  refreshSpotifyAccessToken,
} from ".";

const { postMock, spotifyRequestMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  spotifyRequestMock: vi.fn(),
}));

vi.mock("@chia/utils/request", () => ({
  default: vi.fn(() => spotifyRequestMock),
  post: postMock,
}));

vi.mock("./env", () => ({
  env: {
    SPOTIFY_CLIENT_ID: "client-id",
    SPOTIFY_CLIENT_SECRET: "client-secret",
    SPOTIFY_FAVORITE_PLAYLIST_ID: "playlist-id",
    SPOTIFY_REFRESH_TOKEN: "fallback-refresh-token",
    SPOTIFY_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  },
}));

describe("Spotify API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates an authorization URL with state and least-privilege scopes", () => {
    const url = new URL(
      generateAuthorizeUrl({
        state: "csrf-state",
        scopes: ["user-read-currently-playing"],
        redirectUri: "https://service.example.com/spotify/callback",
      })
    );

    expect(url.origin).toBe("https://accounts.spotify.com");
    expect(url.searchParams.get("state")).toBe("csrf-state");
    expect(url.searchParams.get("scope")).toBe("user-read-currently-playing");
  });

  it("returns the complete client credential token response", async () => {
    const token = {
      access_token: "access-token",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "",
    };
    postMock.mockResolvedValueOnce(token);

    await expect(getSpotifyAccessToken()).resolves.toEqual(token);
  });

  it("refreshes with the provided refresh token", async () => {
    postMock.mockResolvedValueOnce({
      access_token: "new-access-token",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "user-read-currently-playing",
    });

    await refreshSpotifyAccessToken("stored-refresh-token");

    const options = postMock.mock.calls[0]?.[2];
    expect(options.body).toBeInstanceOf(URLSearchParams);
    expect(options.body.get("grant_type")).toBe("refresh_token");
    expect(options.body.get("refresh_token")).toBe("stored-refresh-token");
  });

  it("exchanges an authorization code and accepts a rotated refresh token", async () => {
    const token = {
      access_token: "access-token",
      refresh_token: "rotated-refresh-token",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "user-read-currently-playing",
    };
    postMock.mockResolvedValueOnce(token);

    await expect(
      codeAuthorization({
        code: "authorization-code",
        redirectUri: "https://service.example.com/spotify/callback",
      })
    ).resolves.toEqual(token);
  });

  it("returns null when Spotify reports no current playback", async () => {
    spotifyRequestMock.mockResolvedValueOnce({
      status: 204,
    });

    await expect(
      getNowPlaying({ accessToken: "access-token" })
    ).resolves.toBeNull();
  });

  it("encrypts and decrypts token values", () => {
    const encryptedToken = encryptSpotifyToken("sensitive-token");

    expect(encryptedToken).not.toContain("sensitive-token");
    expect(decryptSpotifyToken(encryptedToken)).toBe("sensitive-token");
  });
});
