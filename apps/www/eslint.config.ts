import { defineConfig } from "eslint/config";

import baseConfig from "@chia/eslint-config/base";
import nextjsConfig from "@chia/eslint-config/nextjs";
import reactConfig from "@chia/eslint-config/react";

export default defineConfig(
  {
    ignores: [".next/**", "**/.map.ts", "@types/**", "next-env.d.ts"],
  },
  baseConfig,
  reactConfig,
  nextjsConfig
);
