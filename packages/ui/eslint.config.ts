import baseConfig from "@chiastack/eslint/base";
import reactConfig from "@chiastack/eslint/react";
import { defineConfig } from "eslint/config";

export default defineConfig(
  {
    ignores: [".next/**"],
  },
  baseConfig,
  reactConfig
);
