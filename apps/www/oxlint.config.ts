import { defineConfig } from "oxlint";

import { nextjs } from "@chiastack/oxlint/nextjs";

export default defineConfig({
  extends: [nextjs],
  ignorePatterns: [".next/**", "**/.map.ts", "next-env.d.ts"],
});
