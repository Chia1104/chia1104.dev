export const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://chia1104.dev"
    : "http://localhost:3000";
export const GITHUB_API = "https://api.github.com/";
export const GITHUB_GRAPHQL_API = "https://api.github.com/graphql";
export const POSTS_PATH =
  process.env.NODE_ENV === "production"
    ? "./posts/published"
    : "./posts/unpublished"; // process.env.NODE_ENV === 'production' ? './posts/published' : './posts/unpublished'

export const YOUTUBE_ID = "UC3k2QizjG1Xp3Qvtuxn1W5A";
export const YOUTUBE_LIST_ID = "PL7XkMe5ddX9Napk5747U6SIOAqWJBsqVM";

export const GOOGLE_API = "https://www.googleapis.com/";
export const SPOTIFY_NOW_PLAYING_URL =
  "https://api.spotify.com/v1/me/player/currently-playing";
export const SPOTIFY_PLAYLIST_URL = "https://api.spotify.com/v1/playlists/";
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

export const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
export const GH_PUBLIC_TOKEN = process.env.GH_PUBLIC_TOKEN;

export const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
export const AUTH_DOMAIN = process.env.NEXT_PUBLIC_AUTH_DOMAIN;
export const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID;
export const STORAGE_BUCKET = process.env.NEXT_PUBLIC_STORAGE_BUCKET;
export const MESSAGING_SENDER_ID = process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID;
export const APP_ID = process.env.NEXT_PUBLIC_APP_ID;
export const MEASUREMENT_ID = process.env.NEXT_PUBLIC_MEASUREMENT_ID;

export const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
export const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

export const FORMSPREE_KEY = process.env.FORMSPREE_KEY;
export const RE_CAPTCHA_KEY = process.env.RE_CAPTCHA_KEY;
