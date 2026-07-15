import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        "__tests__/**",
        "**/*.d.ts",
        "**/*.config.*",
        "**/coverage/**",
      ],
    },
    include: ["__tests__/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist", "coverage"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      test: path.resolve(__dirname, "./__tests__"),
    },
  },
});
