import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    // Matched on the config file, not the directory: `packages/*` also picks up
    // `packages/AGENTS.md`, which vitest refuses as a project entry.
    projects: [
      "apps/www",
      "apps/dash",
      "packages/*/vitest.config.*",
      "apps/service",
      "apps/workflow",
    ],
    coverage: {
      reporter: ["lcov", "html"],
      provider: "v8",
      include: [
        "**/src/**/*.{test,spec}.{ts,tsx}",
        "**/__tests__/**/*.{test,spec}.{ts,tsx}",
      ],
    },
  },
});
