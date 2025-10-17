import type { Linter } from "eslint";
import { defineConfig } from "eslint/config";

import { baseConfig } from "@chia/eslint-config/base";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig
) as Linter.Config;
