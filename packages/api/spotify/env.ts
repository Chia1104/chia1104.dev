import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

const encryptionKeySchema = z.string().refine((value) => {
  return Buffer.from(value, "base64").length === 32;
}, "SPOTIFY_TOKEN_ENCRYPTION_KEY must be a Base64-encoded 32-byte key");

export const env = createEnv({
  server: {
    SPOTIFY_CLIENT_ID: z.string().min(1),
    SPOTIFY_CLIENT_SECRET: z.string().min(1),
    SPOTIFY_FAVORITE_PLAYLIST_ID: z.string().optional(),
    SPOTIFY_REFRESH_TOKEN: z.string().optional(),
    SPOTIFY_REDIRECT_URI: z.string().optional(),
    SPOTIFY_TOKEN_ENCRYPTION_KEY:
      process.env.APP_CODE === "service" &&
      process.env.NODE_ENV === "production"
        ? encryptionKeySchema
        : encryptionKeySchema.optional(),
    /**
     * @deprecated
     */
    SPOTIFY_NOW_PLAYING_URL: z
      .string()
      .optional()
      .default("https://api.spotify.com/v1/me/player/currently-playing"),
    /**
     * @deprecated
     */
    SPOTIFY_TOKEN_URL: z
      .string()
      .optional()
      .default("https://accounts.spotify.com/api/token"),
  },
  runtimeEnv: {
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
    SPOTIFY_FAVORITE_PLAYLIST_ID:
      process.env.NEXT_PUBLIC_SPOTIFY_FAVORITE_PLAYLIST_ID ??
      process.env.SPOTIFY_FAVORITE_PLAYLIST_ID ??
      "4cPPG7mh2a8EZ2jlhJfj9u",
    NEXT_PUBLIC_SPOTIFY_FAVORITE_PLAYLIST_ID:
      process.env.NEXT_PUBLIC_SPOTIFY_FAVORITE_PLAYLIST_ID ??
      "4cPPG7mh2a8EZ2jlhJfj9u",
    SPOTIFY_REFRESH_TOKEN: process.env.SPOTIFY_REFRESH_TOKEN,
    SPOTIFY_REDIRECT_URI: process.env.SPOTIFY_REDIRECT_URI,
    SPOTIFY_TOKEN_ENCRYPTION_KEY: process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY,
    /**
     * @deprecated
     */
    SPOTIFY_NOW_PLAYING_URL:
      process.env.SPOTIFY_NOW_PLAYING_URL ??
      "https://api.spotify.com/v1/me/player/currently-playing",
    /**
     * @deprecated
     */
    SPOTIFY_TOKEN_URL:
      process.env.SPOTIFY_TOKEN_URL ?? "https://accounts.spotify.com/api/token",
  },
  client: {
    NEXT_PUBLIC_SPOTIFY_FAVORITE_PLAYLIST_ID: z.string().optional(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1" ||
    process.env.NODE_ENV === "test",
});
