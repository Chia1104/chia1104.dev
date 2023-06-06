import { z } from "zod";
import { createEnv } from "@t3-oss/env-nextjs";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "production"]).default("development"),
    NEXTAUTH_URL: process.env.VERCEL_URL ? z.string().optional() : z.string(),
    NEXTAUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().optional(),
    GOOGLE_CLIENT_ID: z.string(),
    GOOGLE_CLIENT_SECRET: z.string(),
    RAILWAY_URL: z.string().optional(),
    VERCEL_URL: z.string().optional(),
    ZEABUR_URL: z.string().optional(),
  },

  client: {},
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    RAILWAY_URL: process.env.RAILWAY_STATIC_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    ZEABUR_URL: process.env.ZEABUR_URL,
  },
});
