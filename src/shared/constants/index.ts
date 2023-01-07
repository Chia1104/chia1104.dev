export const IS_PRODUCTION = process.env.NODE_ENV === "production";
export const IS_TEST = process.env.NODE_ENV === "test";

// Site url
export const BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://chia1104.dev"
    : "http://localhost:3000";
export const RAILWAY_URL = process.env.RAILWAY_STATIC_URL;
export const VERCEL_URL = process.env.VERCEL_URL;

// GitHub config
export const GITHUB_API = "https://api.github.com/";
export const GITHUB_GRAPHQL_API = "https://api.github.com/graphql";
export const GH_PUBLIC_TOKEN = process.env.GH_PUBLIC_TOKEN;

// Post path
export const POSTS_PATH = !IS_TEST
  ? IS_PRODUCTION
    ? "./posts/published"
    : "./posts/unpublished"
  : "./posts/examples";

// Youtube config
export const YOUTUBE_ID = "UC3k2QizjG1Xp3Qvtuxn1W5A";
export const YOUTUBE_LIST_ID = "PL7XkMe5ddX9Napk5747U6SIOAqWJBsqVM";

// Google API config
export const GOOGLE_API = "https://www.googleapis.com/";
export const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Spotify config
export const SPOTIFY_NOW_PLAYING_URL =
  "https://api.spotify.com/v1/me/player/currently-playing";
export const SPOTIFY_PLAYLIST_URL = "https://api.spotify.com/v1/playlists/";
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
export const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
export const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// Formspree key
export const FORMSPREE_KEY = process.env.NEXT_PUBLIC_FORMSPREE_KEY || "123xyz";

// reCAPTCHA public key
export const RE_CAPTCHA_KEY = process.env.NEXT_PUBLIC_RE_CAPTCHA_KEY;

export const ZEABUR_URL = process.env.ZEABUR_URL;
