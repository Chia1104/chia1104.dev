import { defineConfig } from "eslint/config";

import baseConfig from "@chia/eslint-config/base";
import reactConfig from "@chia/eslint-config/react";

export default defineConfig(
  {
    ignores: ["**/*.d.ts"],
  },
  baseConfig,
  reactConfig
);
