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
