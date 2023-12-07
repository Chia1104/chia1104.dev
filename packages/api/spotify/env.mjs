// @ts-check

import { z } from "zod";
import { createEnv } from "@t3-oss/env-nextjs";

export const env = createEnv({
  server: {
    SPOTIFY_CLIENT_ID: z.string().min(1),
    SPOTIFY_CLIENT_SECRET: z.string().min(1),
    SPOTIFY_FAVORITE_PLAYLIST_ID: z
      .string()
      .optional()
      .default("37i9dQZF1Epyg7jBW9q502"),
    SPOTIFY_REFRESH_TOKEN: z.string().optional(),
    SPOTIFY_NOW_PLAYING_URL: z
      .string()
      .optional()
      .default("https://api.spotify.com/v1/me/player/currently-playing"),
    SPOTIFY_TOKEN_URL: z
      .string()
      .optional()
      .default("https://accounts.spotify.com/api/token"),
  },
  runtimeEnv: {
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
    SPOTIFY_FAVORITE_PLAYLIST_ID: process.env.SPOTIFY_FAVORITE_PLAYLIST_ID,
    SPOTIFY_REFRESH_TOKEN: process.env.SPOTIFY_REFRESH_TOKEN,
    SPOTIFY_NOW_PLAYING_URL: process.env.SPOTIFY_NOW_PLAYING_URL,
    SPOTIFY_TOKEN_URL: process.env.SPOTIFY_TOKEN_URL,
  },
});
