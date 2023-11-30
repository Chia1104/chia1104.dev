import { z } from "zod";

export const nodeEnvSchema = z
  .enum(["development", "production", "test"])
  .default("development");

export const envSchema = z
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
