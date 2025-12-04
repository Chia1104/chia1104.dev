import baseConfig from "@chiastack/eslint/base";
import nextjsConfig from "@chiastack/eslint/nextjs";
import reactConfig from "@chiastack/eslint/react";
import { defineConfig } from "eslint/config";

export default defineConfig(
  {
    ignores: [".next/**", "**/.map.ts", "next-env.d.ts"],
  },
  baseConfig,
  reactConfig,
  nextjsConfig
);
