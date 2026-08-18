import { defineConfig } from "oxlint";

import { baseConfig } from "@chiastack/oxlint/base";

import {
  antiSlopRules,
  typescriptLintOverrides,
} from "../../toolings/oxlint/config.mjs";

export default defineConfig({
  extends: [baseConfig],
  jsPlugins: [
    {
      name: "anti-slop",
      specifier: "../../toolings/oxlint/index.ts",
    },
  ],
  ignorePatterns: ["**/*.d.ts", ".output", "scripts", "__tests__/**"],
  overrides: typescriptLintOverrides,
  rules: antiSlopRules,
});
