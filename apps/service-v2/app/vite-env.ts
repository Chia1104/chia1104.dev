/// <reference types="vite/client" />
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    PORT: z.number().optional().default(3005),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .optional()
      .default("development"),
    REDIS_URL: z.string().optional(),
    REDIS_URI: z.string().optional(),
    CORS_ALLOWED_ORIGIN: z.string().optional(),
    AUTH_SECRET: z.string().min(1),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    AUTH_REDIRECT_PROXY_URL: z.string().optional(),
    AUTH_URL: z.string().optional(),
    AUTH_COOKIE_DOMAIN: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
  },
  runtimeEnv: {
    PORT: import.meta.env.PORT ? Number(import.meta.env.PORT) : 3005,
    NODE_ENV: import.meta.env.NODE_ENV ?? "development",
    REDIS_URL: import.meta.env.VITE_REDIS_URL,
    REDIS_URI: import.meta.env.VITE_REDIS_URI,
    CORS_ALLOWED_ORIGIN: import.meta.env.VITE_CORS_ALLOWED_ORIGIN,
    AUTH_SECRET: import.meta.env.VITE_AUTH_SECRET,
    GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
    AUTH_REDIRECT_PROXY_URL: import.meta.env.VITE_AUTH_REDIRECT_PROXY_URL,
    AUTH_URL: import.meta.env.VITE_AUTH_URL,
    AUTH_COOKIE_DOMAIN: import.meta.env.VITE_AUTH_COOKIE_DOMAIN,
    RESEND_API_KEY: import.meta.env.VITE_RESEND_API_KEY,
  },
  skipValidation:
    import.meta.env.VITE_SKIP_ENV_VALIDATION === "true" ||
    import.meta.env.VITE_SKIP_ENV_VALIDATION === "1",
});

export type ENV = typeof env;
