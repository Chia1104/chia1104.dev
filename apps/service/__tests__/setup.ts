import { vi } from "vitest";

import { stubTestEnv } from "@chia/test/env";

stubTestEnv({
  SKIP_ENV_VALIDATION: "false",
  CORS_ALLOWED_ORIGIN: "http://localhost:3000",
  RESEND_API_KEY: "test-resend-api-key",
  FIRECRAWL_API_KEY: "test-firecrawl-api-key",
  DATABASE_URL: "postgres://postgres:password@localhost:5432/test",
  DATABASE_URL_REPLICA_1: undefined,
  BETA_DATABASE_URL: "postgres://postgres:password@localhost:5432/test",
  LOCAL_DATABASE_URL: "postgres://postgres:password@localhost:5432/test",
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
  SPOTIFY_CLIENT_ID: "test-spotify-client-id",
  SPOTIFY_CLIENT_SECRET: "test-spotify-client-secret",
  SPOTIFY_FAVORITE_PLAYLIST_ID: "test-spotify-favorite-playlist-id",
  SPOTIFY_REFRESH_TOKEN: "test-spotify-refresh-token",
  SPOTIFY_REDIRECT_URI: "http://localhost:3005/api/v1/spotify/oauth/callback",
  SPOTIFY_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  SPOTIFY_NOW_PLAYING_URL:
    "https://api.spotify.com/v1/me/player/currently-playing",
  SPOTIFY_TOKEN_URL: "https://accounts.spotify.com/api/token",
  NEXT_PUBLIC_SPOTIFY_FAVORITE_PLAYLIST_ID:
    process.env.NEXT_PUBLIC_SPOTIFY_FAVORITE_PLAYLIST_ID ??
    "test-spotify-favorite-playlist-id",
  S3_ACCESS_KEY_ID: "test-s3-access-key-id",
  S3_SECRET_ACCESS_KEY: "test-s3-secret-access-key",
  S3_REGION: "us-east-1",
  S3_BUCKET_NAME: "test-bucket",
  S3_ENDPOINT: undefined,
  NEXT_PUBLIC_CAPTCHA_PROVIDER: "google-recaptcha",
  CAPTCHA_SECRET_KEY: "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe",
  CACHE_PROVIDER: "auto",
  CACHE_URI: "redis://localhost:6379",
  WORKFLOW_TARGET_WORLD: "@workflow/world-postgres",
  WORKFLOW_POSTGRES_URL: "postgres://postgres:password@localhost:5432/test",
  INTERNAL_WORKFLOW_SERVICE_ENDPOINT: "http://workflow.test",
  INTERNAL_WORKFLOW_SERVICE_TOKEN: "w".repeat(32),
});

vi.mock("@chia/kv/redis", async () => {
  const { getRedisKv } = await import("@chia/test/mocks/kv");
  return { getRedisKv };
});

vi.mock("../src/guards/rate-limiter.guard", async () => {
  const mocks = await import("./helpers/guards");
  return {
    rateLimiterGuard: mocks.rateLimiterGuard,
  };
});

vi.mock("../src/guards/auth.guard", async () => {
  const mocks = await import("./helpers/guards");
  return {
    verifyAuth: mocks.verifyAuth,
  };
});

vi.mock("../src/guards/operator.guard", async () => {
  const mocks = await import("./helpers/guards");
  return { verifyOperator: mocks.verifyOperator };
});

vi.mock("../src/guards/ai.guard", async () => {
  const mocks = await import("./helpers/guards");
  return {
    ai: mocks.ai,
    AI_AUTH_TOKEN: mocks.AI_AUTH_TOKEN,
  };
});

vi.mock("@chia/api/orpc/guards/rate-limit.guard", async () => {
  const mocks = await import("./helpers/guards");
  return { rateLimitGuard: mocks.orpcRateLimitGuard };
});

vi.mock("@chia/api/orpc/guards/caller.guard", async () => {
  const mocks = await import("./helpers/guards");
  return {
    callerGuard: mocks.orpcCallerGuard,
    tieredRateLimitGuard: mocks.orpcTieredRateLimitGuard,
  };
});

vi.mock("@chia/api/orpc/guards/captcha.guard", async () => {
  const mocks = await import("./helpers/guards");
  return { captchaGuard: mocks.orpcCaptchaGuard };
});

vi.mock("@chia/api/orpc/guards/ai-key.guard", async () => {
  const mocks = await import("./helpers/guards");
  return { aiKeyGuard: mocks.orpcAiKeyGuard };
});

vi.mock("workflow/api", async () => {
  const { getHookByToken, getRun } = await import("@chia/test/mocks/workflow");
  return { getRun, getHookByToken };
});

vi.mock("../src/services/feed-indexing.service", () => ({
  feedHooks: {
    onFeedChanged: vi.fn().mockResolvedValue(undefined),
    onFeedRemoved: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@chia/db/repos/feeds", async () => {
  const { feedRepoMocks } = await import("@chia/test/mocks/db-feeds");
  return feedRepoMocks;
});

vi.mock("@chia/db/repos/feeds/search", async () => {
  const { getRelatedFeeds } = await import("@chia/test/mocks/db-feeds");
  return { getRelatedFeeds };
});

vi.mock("@chia/api/resources/search", async () => {
  const { searchResources } = await import("@chia/test/mocks/db-feeds");
  return { searchResources };
});
