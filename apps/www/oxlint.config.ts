import { defineConfig } from "oxlint";

import { nextjs } from "@chiastack/oxlint/nextjs";

import {
  antiSlopRules,
  typescriptLintOverrides,
} from "../../toolings/oxlint/config.mjs";

export default defineConfig({
  extends: [nextjs],
  jsPlugins: [
    {
      name: "anti-slop",
      specifier: "../../toolings/oxlint/index.ts",
    },
  ],
  ignorePatterns: [".next/**", "**/.map.ts", "next-env.d.ts"],
  overrides: typescriptLintOverrides,
  rules: antiSlopRules,
});
