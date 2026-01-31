// Mock guards
vi.mock("../src/guards/rate-limiter.guard", async () => {
  const mocks = await import("./__mocks__/guards.mock");
  return {
    rateLimiterGuard: mocks.rateLimiterGuard,
  };
});

vi.mock("../src/guards/captcha.guard", async () => {
  const mocks = await import("./__mocks__/guards.mock");
  return {
    siteverify: mocks.siteverify,
  };
});

vi.mock("../src/guards/auth.guard", async () => {
  const mocks = await import("./__mocks__/guards.mock");
  return {
    verifyAuth: mocks.verifyAuth,
  };
});

vi.mock("../src/guards/apikey-verify.guard", async () => {
  const mocks = await import("./__mocks__/guards.mock");
  return {
    apikeyVerify: mocks.apikeyVerify,
  };
});

vi.mock("../src/guards/ai.guard", async () => {
  const mocks = await import("./__mocks__/guards.mock");
  return {
    ai: mocks.ai,
    AI_AUTH_TOKEN: mocks.AI_AUTH_TOKEN,
  };
});

// Mock database repos
vi.mock("@chia/db/repos/feeds", async () => {
  const mocks = await import("./__mocks__/db.mock");
  return {
    getInfiniteFeedsByUserId: mocks.getInfiniteFeedsByUserId,
    getInfiniteFeeds: mocks.getInfiniteFeeds,
    getFeedBySlug: mocks.getFeedBySlug,
    getFeedById: mocks.getFeedById,
    upsertFeedTranslation: mocks.upsertFeedTranslation,
    upsertContent: mocks.upsertContent,
    updateFeed: mocks.updateFeed,
  };
});

vi.mock("@chia/db/repos/feeds/embedding", async () => {
  const mocks = await import("./__mocks__/db.mock");
  return {
    searchFeeds: mocks.searchFeeds,
  };
});

vi.mock("@chia/db/repos/public/feeds", async () => {
  const mocks = await import("./__mocks__/db.mock");
  return {
    getPublicFeedsTotal: mocks.getPublicFeedsTotal,
  };
});

export const mockEnv = {
  NODE_ENV: "test",
  CORS_ALLOWED_ORIGIN: "http://localhost:3000",
  RESEND_API_KEY: "test-resend-api-key",
  // Database env
  DATABASE_URL: "postgres://postgres:password@localhost:5432/test",
  DATABASE_URL_REPLICA_1: undefined,
  BETA_DATABASE_URL: "postgres://postgres:password@localhost:5432/test",
  LOCAL_DATABASE_URL: "postgres://postgres:password@localhost:5432/test",
  // Auth env
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  GITHUB_CLIENT_ID: "test-github-client-id",
  GITHUB_CLIENT_SECRET: "test-github-client-secret",
  AUTH_SECRET: "test-auth-secret",
  AUTH_URL: "http://localhost:3000",
  AUTH_BASE_PATH: "/api/v1/auth",
  CF_BYPASS_TOKEN: "test-cf-bypass-token",
  CH_API_KEY: process.env.CH_API_KEY ?? "test-ch-api-key",
  ADMIN_ID: process.env.ADMIN_ID ?? "test-admin-id",
  BETA_ADMIN_ID: process.env.BETA_ADMIN_ID ?? "test-beta-admin-id",
  LOCAL_ADMIN_ID: process.env.LOCAL_ADMIN_ID ?? "test-local-admin-id",
  // Spotify env
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID ?? "test-spotify-client-id",
  SPOTIFY_CLIENT_SECRET:
    process.env.SPOTIFY_CLIENT_SECRET ?? "test-spotify-client-secret",
  SPOTIFY_FAVORITE_PLAYLIST_ID:
    process.env.SPOTIFY_FAVORITE_PLAYLIST_ID ??
    "test-spotify-favorite-playlist-id",
  SPOTIFY_REFRESH_TOKEN:
    process.env.SPOTIFY_REFRESH_TOKEN ?? "test-spotify-refresh-token",
  SPOTIFY_REDIRECT_URI: undefined,
  SPOTIFY_NOW_PLAYING_URL:
    "https://api.spotify.com/v1/me/player/currently-playing",
  SPOTIFY_TOKEN_URL: "https://accounts.spotify.com/api/token",
  NEXT_PUBLIC_SPOTIFY_FAVORITE_PLAYLIST_ID:
    process.env.NEXT_PUBLIC_SPOTIFY_FAVORITE_PLAYLIST_ID ??
    "test-spotify-favorite-playlist-id",
  // S3 env
  S3_ACCESS_KEY_ID: "test-s3-access-key-id",
  S3_SECRET_ACCESS_KEY: "test-s3-secret-access-key",
  S3_REGION: "us-east-1",
  S3_BUCKET_NAME: "test-bucket",
  S3_ENDPOINT: undefined,
  // Captcha env
  NEXT_PUBLIC_CAPTCHA_PROVIDER: "google-recaptcha",
  CAPTCHA_SECRET_KEY: "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe",
  // KV/Cache env
  CACHE_PROVIDER: "auto",
  CACHE_URI: "redis://localhost:6379",
};

vi.stubEnv("NODE_ENV", mockEnv.NODE_ENV);
vi.stubEnv("CORS_ALLOWED_ORIGIN", mockEnv.CORS_ALLOWED_ORIGIN);
vi.stubEnv("RESEND_API_KEY", mockEnv.RESEND_API_KEY);
vi.stubEnv("DATABASE_URL", mockEnv.DATABASE_URL);
vi.stubEnv("DATABASE_URL_REPLICA_1", mockEnv.DATABASE_URL_REPLICA_1);
vi.stubEnv("BETA_DATABASE_URL", mockEnv.BETA_DATABASE_URL);
vi.stubEnv("LOCAL_DATABASE_URL", mockEnv.LOCAL_DATABASE_URL);
vi.stubEnv("GOOGLE_CLIENT_ID", mockEnv.GOOGLE_CLIENT_ID);
vi.stubEnv("GOOGLE_CLIENT_SECRET", mockEnv.GOOGLE_CLIENT_SECRET);
vi.stubEnv("GITHUB_CLIENT_ID", mockEnv.GITHUB_CLIENT_ID);
vi.stubEnv("GITHUB_CLIENT_SECRET", mockEnv.GITHUB_CLIENT_SECRET);
vi.stubEnv("AUTH_SECRET", mockEnv.AUTH_SECRET);
vi.stubEnv("AUTH_URL", mockEnv.AUTH_URL);
vi.stubEnv("AUTH_BASE_PATH", mockEnv.AUTH_BASE_PATH);
vi.stubEnv("CF_BYPASS_TOKEN", mockEnv.CF_BYPASS_TOKEN);
vi.stubEnv("CH_API_KEY", mockEnv.CH_API_KEY);
vi.stubEnv("ADMIN_ID", mockEnv.ADMIN_ID);
vi.stubEnv("BETA_ADMIN_ID", mockEnv.BETA_ADMIN_ID);
vi.stubEnv("LOCAL_ADMIN_ID", mockEnv.LOCAL_ADMIN_ID);
vi.stubEnv("SPOTIFY_CLIENT_ID", mockEnv.SPOTIFY_CLIENT_ID);
vi.stubEnv("SPOTIFY_CLIENT_SECRET", mockEnv.SPOTIFY_CLIENT_SECRET);
vi.stubEnv(
  "SPOTIFY_FAVORITE_PLAYLIST_ID",
  mockEnv.SPOTIFY_FAVORITE_PLAYLIST_ID
);
vi.stubEnv("SPOTIFY_REFRESH_TOKEN", mockEnv.SPOTIFY_REFRESH_TOKEN);
vi.stubEnv("SPOTIFY_REDIRECT_URI", mockEnv.SPOTIFY_REDIRECT_URI);
vi.stubEnv("SPOTIFY_NOW_PLAYING_URL", mockEnv.SPOTIFY_NOW_PLAYING_URL);
vi.stubEnv("SPOTIFY_TOKEN_URL", mockEnv.SPOTIFY_TOKEN_URL);
vi.stubEnv(
  "NEXT_PUBLIC_SPOTIFY_FAVORITE_PLAYLIST_ID",
  mockEnv.NEXT_PUBLIC_SPOTIFY_FAVORITE_PLAYLIST_ID
);
vi.stubEnv("S3_ACCESS_KEY_ID", mockEnv.S3_ACCESS_KEY_ID);
vi.stubEnv("S3_SECRET_ACCESS_KEY", mockEnv.S3_SECRET_ACCESS_KEY);
vi.stubEnv("S3_REGION", mockEnv.S3_REGION);
vi.stubEnv("S3_BUCKET_NAME", mockEnv.S3_BUCKET_NAME);
vi.stubEnv("S3_ENDPOINT", mockEnv.S3_ENDPOINT);
vi.stubEnv(
  "NEXT_PUBLIC_CAPTCHA_PROVIDER",
  mockEnv.NEXT_PUBLIC_CAPTCHA_PROVIDER
);
vi.stubEnv("CAPTCHA_SECRET_KEY", mockEnv.CAPTCHA_SECRET_KEY);
vi.stubEnv("CACHE_PROVIDER", mockEnv.CACHE_PROVIDER);
vi.stubEnv("CACHE_URI", mockEnv.CACHE_URI);
