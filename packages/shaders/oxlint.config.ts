import { defineConfig } from "oxlint";

import { react } from "@chiastack/oxlint/react";

import {
  antiSlopRules,
  typescriptLintOverrides,
} from "../../toolings/oxlint/config.mjs";

export default defineConfig({
  extends: [react],
  jsPlugins: [
    {
      name: "anti-slop",
      specifier: "../../toolings/oxlint/index.ts",
    },
  ],
  overrides: typescriptLintOverrides,
  rules: antiSlopRules,
});
