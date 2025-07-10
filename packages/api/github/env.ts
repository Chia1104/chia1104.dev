import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    GITHUB_API: z.string().optional().default("https://api.github.com"),
    GITHUB_GRAPHQL_API: z
      .string()
      .optional()
      .default("https://api.github.com/graphql"),
    GH_PUBLIC_TOKEN: z.string().min(1),
  },
  runtimeEnv: {
    GITHUB_API: process.env.GITHUB_API ?? "https://api.github.com",
    GITHUB_GRAPHQL_API:
      process.env.GITHUB_GRAPHQL_API ?? "https://api.github.com/graphql",
    GH_PUBLIC_TOKEN: process.env.GH_PUBLIC_TOKEN,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
});
