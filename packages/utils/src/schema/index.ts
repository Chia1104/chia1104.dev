import * as z from "zod";

export const NodeEnvSchema = z
  .enum(["development", "production", "test"])
  .default("development");
export type NodeEnv = z.infer<typeof NodeEnvSchema>;

export const AppEnvSchema = z
  .enum([
    "preview",
    "development",
    "local",
    "beta",
    "gamma",
    "prod",
    "production",
    "test",
    "zeabur-prod",
    "vercel-prod",
    "railway-prod",
    "zeabur-dev",
    "vercel-dev",
    "railway-dev",
  ])
  .default("development");

export type AppEnv = z.infer<typeof AppEnvSchema>;

export const NumericStringSchema = z.string().pipe(z.coerce.number());

export const Service = {
  LegacyService: "legacy-service",
  Auth: "auth",
  Content: "content",
  AI: "ai",
} as const;

export type Service = (typeof Service)[keyof typeof Service];

export const ServiceSchema = z.enum(Service);
