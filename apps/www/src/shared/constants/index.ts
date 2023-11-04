export const IS_PRODUCTION = process.env.NODE_ENV === "production";
export const IS_TEST = process.env.NODE_ENV === "test";

// Site url
export const BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://chia1104.dev"
    : "http://localhost:3000";

/**
 * @deprecated use `env.RAILWAY_URL` instead
 */
export const RAILWAY_URL = process.env.RAILWAY_STATIC_URL;

/**
 * @deprecated use `env.VERCEL_URL` instead
 */
export const VERCEL_URL = process.env.VERCEL_URL;

/**
 * @deprecated use `env.GITHUB_API` instead
 */
export const GITHUB_API = "https://api.github.com/";

/**
 * @deprecated use `env.GITHUB_GRAPHQL_API` instead
 */
export const GITHUB_GRAPHQL_API = "https://api.github.com/graphql";

/**
 * @deprecated use `env.GH_PUBLIC_TOKEN` instead
 */
export const GH_PUBLIC_TOKEN = process.env.GH_PUBLIC_TOKEN;

// Post path
export const POSTS_PATH = !IS_TEST
  ? IS_PRODUCTION
    ? "./posts/published"
    : "./posts/unpublished"
  : "./posts/examples";

/**
 * @deprecated use `env.YOUTUBE_ID` instead
 */
export const YOUTUBE_ID = null;

/**
 * @deprecated use `env.YOUTUBE_LIST_ID` instead
 */
export const YOUTUBE_LIST_ID = null;

/**
 * @deprecated use `env.GOOGLE_API` instead
 */
export const GOOGLE_API = "https://www.googleapis.com";

/**
 * @deprecated use `env.GOOGLE_API_KEY` instead
 */
export const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

/**
 * @deprecated use `env.SPOTIFY_NOW_PLAYING_URL` instead
 */
export const SPOTIFY_NOW_PLAYING_URL =
  "https://api.spotify.com/v1/me/player/currently-playing";

/**
 * @deprecated
 */
export const SPOTIFY_PLAYLIST_URL = "https://api.spotify.com/v1/playlists/";

/**
 * @deprecated use `env.SPOTIFY_TOKEN_URL` instead
 */
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

/**
 * @deprecated use `env.SPOTIFY_CLIENT_ID` instead
 */
export const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;

/**
 * @deprecated use `env.SPOTIFY_CLIENT_SECRET` instead
 */
export const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

/**
 * @deprecated use `env.RE_CAPTCHA_KEY` instead
 */
export const RE_CAPTCHA_KEY = process.env.NEXT_PUBLIC_RE_CAPTCHA_KEY;

/**
 * @deprecated use `env.ZEABUR_URL` instead
 */
export const ZEABUR_URL = process.env.ZEABUR_URL;

/**
 * @deprecated use `env.SHA_256_HASH` instead
 */
export const SHA_256_HASH = process.env.SHA_256_HASH ?? "SHA_256_HASH";

/**
 * @deprecated use `env.SHA_256_HASH` instead
 */
export const VERCEL = process.env.VERCEL;
