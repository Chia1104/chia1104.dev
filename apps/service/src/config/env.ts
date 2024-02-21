import { z } from "zod";

export const appEnvSchema = z.object({
  PORT: z
    .string()
    .default("3000")
    .optional()
    .refine((val) => {
      if (!val) return true;
      const port = parseInt(val, 10);
      return port > 0 && port < 65536;
    }),
  THROTTLE_LIMIT: z
    .string()
    .default("10")
    .optional()
    .refine((val) => {
      if (!val) return true;
      const limit = parseInt(val, 10);
      return limit > 0;
    }),
  THROTTLE_TTL: z
    .string()
    .default("60")
    .optional()
    .refine((val) => {
      if (!val) return true;
      const ttl = parseInt(val, 10);
      return ttl > 0;
    }),
  REDIS_URL: z.string().optional(),
  REDIS_URI: z.string().optional(),
  SPOTIFY_CLIENT_ID: z.string().min(1),
  SPOTIFY_CLIENT_SECRET: z.string().min(1),
  SPOTIFY_REDIRECT_URI: z.string().min(1),
  CORS_ALLOWED_ORIGIN: z.string().optional(),
});

export type AppEnv = z.infer<typeof appEnvSchema>;

export default () => ({
  PORT: process.env.PORT,
  THROTTLE_LIMIT: process.env.THROTTLE_LIMIT,
  THROTTLE_TTL: process.env.THROTTLE_TTL,
  REDIS_URL: process.env.REDIS_URL,
  REDIS_URI: process.env.REDIS_URI,
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI: process.env.SPOTIFY_REDIRECT_URI,
  CORS_ALLOWED_ORIGIN: process.env.CORS_ALLOWED_ORIGIN,
});
