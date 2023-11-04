import { z } from "zod";
import { createEnv } from "@t3-oss/env-nextjs";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    RAILWAY_URL: z.string().optional(),
    VERCEL_URL: z.string().optional(),
    ZEABUR_URL: z.string().optional(),
    GH_PUBLIC_TOKEN: z.string().min(1),
    SITE_URL: z.string().optional().default("https://www.chia1104.dev"),
    RE_CAPTCHA_KEY: z.string().min(1),
    GOOGLE_API_KEY: z.string().min(1),
    /**
     * @todo
     */
    SPOTIFY_CLIENT_ID: z.string().optional(),
    /**
     * @todo
     */
    SPOTIFY_CLIENT_SECRET: z.string().optional(),
    /**
     * @deprecated
     */
    SENDGRID_KEY: z.string().optional(),
    REDIS_URL: z.string().min(1),
    UPSTASH_TOKEN: z.string().min(1),
    SHA_256_HASH: z.string().min(1),
    RESEND_API_KEY: z.string().min(1),
    UMAMI_DB_URL: z.string().optional(),
    UMAMI_EDGE_DB_URL: z.string().optional(),
    YOUTUBE_ID: z.string().min(1),
    YOUTUBE_LIST_ID: z.string().min(1),
    VERCEL: z.string().optional(),
    GITHUB_API: z.string().optional().default("https://api.github.com"),
    GITHUB_GRAPHQL_API: z
      .string()
      .optional()
      .default("https://api.github.com/graphql"),
    GOOGLE_API: z.string().optional().default("https://www.googleapis.com"),
    SPOTIFY_NOW_PLAYING_URL: z
      .string()
      .optional()
      .default("https://api.spotify.com/v1/me/player/currently-playing"),
    SPOTIFY_TOKEN_URL: z
      .string()
      .optional()
      .default("https://accounts.spotify.com/api/token"),
  },

  client: {
    NEXT_PUBLIC_RE_CAPTCHA_KEY: z.string().min(1),
    NEXT_PUBLIC_UMAMI_WEBSITE_ID: z.string().min(1),
    NEXT_PUBLIC_UMAMI_URL: z.string().min(1),
    NEXT_PUBLIC_GISCUS_REPO: z
      .string()
      .optional()
      .default("Chia1104/chia1104.dev"),
    NEXT_PUBLIC_GISCUS_REPO_ID: z.string().min(1),
    NEXT_PUBLIC_GISCUS_CATEGORY_ID: z.string().min(1),
    NEXT_PUBLIC_GISCUS_CATEGORY: z.string().optional().default("Comments"),
    NEXT_PUBLIC_GISCUS_THEME: z.string().optional().default("dark_dimmed"),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    RAILWAY_URL: process.env.RAILWAY_STATIC_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    ZEABUR_URL: process.env.ZEABUR_URL,
    GH_PUBLIC_TOKEN: process.env.GH_PUBLIC_TOKEN,
    SITE_URL: process.env.SITE_URL,
    RE_CAPTCHA_KEY: process.env.RE_CAPTCHA_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
    SENDGRID_KEY: process.env.SENDGRID_KEY,
    REDIS_URL: process.env.REDIS_URL,
    UPSTASH_TOKEN: process.env.UPSTASH_TOKEN,
    SHA_256_HASH: process.env.SHA_256_HASH,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    UMAMI_DB_URL: process.env.UMAMI_DB_URL,
    UMAMI_EDGE_DB_URL: process.env.UMAMI_EDGE_DB_URL,
    NEXT_PUBLIC_RE_CAPTCHA_KEY: process.env.NEXT_PUBLIC_RE_CAPTCHA_KEY,
    NEXT_PUBLIC_UMAMI_WEBSITE_ID: process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID,
    NEXT_PUBLIC_UMAMI_URL: process.env.NEXT_PUBLIC_UMAMI_URL,
    YOUTUBE_ID: process.env.YOUTUBE_ID,
    YOUTUBE_LIST_ID: process.env.YOUTUBE_LIST_ID,
    VERCEL: process.env.VERCEL,
    GITHUB_API: process.env.GITHUB_API,
    GITHUB_GRAPHQL_API: process.env.GITHUB_GRAPHQL_API,
    GOOGLE_API: process.env.GOOGLE_API,
    SPOTIFY_NOW_PLAYING_URL: process.env.SPOTIFY_NOW_PLAYING_URL,
    SPOTIFY_TOKEN_URL: process.env.SPOTIFY_TOKEN_URL,
    NEXT_PUBLIC_GISCUS_REPO: process.env.NEXT_PUBLIC_GISCUS_REPO,
    NEXT_PUBLIC_GISCUS_REPO_ID: process.env.NEXT_PUBLIC_GISCUS_REPO_ID,
    NEXT_PUBLIC_GISCUS_CATEGORY_ID: process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID,
    NEXT_PUBLIC_GISCUS_CATEGORY: process.env.NEXT_PUBLIC_GISCUS_CATEGORY,
    NEXT_PUBLIC_GISCUS_THEME: process.env.NEXT_PUBLIC_GISCUS_THEME,
  },
});
