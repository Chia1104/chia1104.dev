import { defineConfig } from "oxlint";

import { baseConfig } from "@chiastack/oxlint/base";

export default defineConfig({
  extends: [baseConfig],
  ignorePatterns: ["**/*.d.ts", ".output", "scripts", "__tests__/**"],
});
