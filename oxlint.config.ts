import { defineConfig } from "oxlint";

import { baseConfig } from "@chiastack/oxlint/base";

export default defineConfig({
  extends: [baseConfig],
  jsPlugins: [
    {
      name: "turbo",
      specifier: "eslint-plugin-turbo",
    },
  ],
  ignorePatterns: [
    "legacy/**",
    "**/*.d.ts",
    ".output",
    "**/*.config.*",
    "dist/**",
    "build/**",
    "node_modules/**",
  ],
});
