import { mock } from "bun:test";

import type { ENV } from "../src/env";

// 創建 mock env 對象
const mockEnv: ENV = {
  PORT: 3005,
  NODE_ENV: "test",
  CORS_ALLOWED_ORIGIN: "http://localhost:3000",
  RESEND_API_KEY: "test-resend-api-key",
  SENTRY_DSN: undefined,
  ZEABUR_SERVICE_ID: undefined,
  RATELIMIT_WINDOW_MS: 300000,
  RATELIMIT_MAX: 300,
  OPENAI_API_KEY: undefined,
  AI_AUTH_PUBLIC_KEY: undefined,
  AI_AUTH_PRIVATE_KEY: undefined,
  IP_DENY_LIST: undefined,
  IP_ALLOW_LIST: undefined,
  MAINTENANCE_MODE: "false",
  MAINTENANCE_BYPASS_TOKEN: undefined,
  TIMEOUT_MS: 10000,
  PROJECT_ID: undefined,
  TRIGGER_SECRET_KEY: undefined,
  ANTHROPIC_API_KEY: undefined,
  GENAI_API_KEY: undefined,
  OLLAMA_BASE_URL: undefined,
  // Database env
  DATABASE_URL: "postgres://postgres:password@localhost:5432/test",
  DATABASE_URL_REPLICA_1: undefined,
  BETA_DATABASE_URL: undefined,
  LOCAL_DATABASE_URL: undefined,
  // Auth env
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  GITHUB_CLIENT_ID: "test-github-client-id",
  GITHUB_CLIENT_SECRET: "test-github-client-secret",
  AUTH_SECRET: "test-auth-secret",
  AUTH_URL: "http://localhost:3000",
  AUTH_COOKIE_DOMAIN: ".chia1104.dev",
  AUTH_BASE_PATH: "/api/v1/auth",
  CF_BYPASS_TOKEN: undefined,
  CH_API_KEY: undefined,
  ADMIN_ID: undefined,
  BETA_ADMIN_ID: undefined,
  LOCAL_ADMIN_ID: undefined,
  // Spotify env
  SPOTIFY_CLIENT_ID: "test-spotify-client-id",
  SPOTIFY_CLIENT_SECRET: "test-spotify-client-secret",
  SPOTIFY_FAVORITE_PLAYLIST_ID: "4cPPG7mh2a8EZ2jlhJfj9u",
  SPOTIFY_REFRESH_TOKEN: "test-spotify-refresh-token",
  SPOTIFY_REDIRECT_URI: undefined,
  SPOTIFY_NOW_PLAYING_URL:
    "https://api.spotify.com/v1/me/player/currently-playing",
  SPOTIFY_TOKEN_URL: "https://accounts.spotify.com/api/token",
  NEXT_PUBLIC_SPOTIFY_FAVORITE_PLAYLIST_ID: "4cPPG7mh2a8EZ2jlhJfj9u",
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
  UPSTASH_REDIS_REST_URL: undefined,
  UPSTASH_REDIS_REST_TOKEN: undefined,
  REDIS_URI: undefined,
  VALKEY_URI: undefined,
  POSTGRES_URI: undefined,
  CACHE_URI: undefined,
  // Service env
  INTERNAL_SERVICE_ENDPOINT: undefined,
  INTERNAL_AUTH_SERVICE_ENDPOINT: undefined,
  INTERNAL_CONTENT_SERVICE_ENDPOINT: undefined,
  INTERNAL_AI_SERVICE_ENDPOINT: undefined,
  NEXT_PUBLIC_SERVICE_PROXY_ENDPOINT: undefined,
  NEXT_PUBLIC_SERVICE_ENDPOINT: undefined,
};

// Mock env 模組
mock.module("../src/env", () => ({
  env: mockEnv,
}));
