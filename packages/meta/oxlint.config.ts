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
  ignorePatterns: ["dist/**"],
  overrides: typescriptLintOverrides,
  rules: antiSlopRules,
});
