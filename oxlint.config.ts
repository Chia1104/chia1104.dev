import { defineConfig } from "oxlint";

import { baseConfig } from "@chiastack/oxlint/base";

import {
  antiSlopRules,
  typescriptLintOverrides,
} from "./toolings/oxlint/config.mjs";

export default defineConfig({
  extends: [baseConfig],
  jsPlugins: [
    {
      name: "anti-slop",
      specifier: "./toolings/oxlint/index.ts",
    },
    {
      name: "turbo",
      specifier: "eslint-plugin-turbo",
    },
  ],
  ignorePatterns: [
    ".agent/**",
    ".agents/**",
    ".claude/**",
    ".codex/**",
    ".continue/**",
    ".cursor/**",
    ".gemini/**",
    ".opencode/**",
    ".pi/**",
    ".roo/**",
    ".windsurf/**",
    "legacy/**",
    "**/*.d.ts",
    ".output",
    "**/*.config.*",
    "dist/**",
    "build/**",
    "node_modules/**",
    "toolings/oxlint/**",
  ],
  overrides: typescriptLintOverrides,
  rules: antiSlopRules,
});
