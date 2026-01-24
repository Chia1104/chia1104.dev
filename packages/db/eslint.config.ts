import { defineConfig } from "eslint/config";

import baseConfig from "@chiastack/eslint/base";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig
);
