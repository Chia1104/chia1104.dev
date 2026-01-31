import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: ["apps/www", "apps/dash", "packages/*", "apps/service"],
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
