import path from "node:path";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // @ts-ignore
  plugins: [react()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        ".next/**",
        "__tests__/**",
        "**/*.d.ts",
        "**/*.config.*",
        "**/coverage/**",
        "src/instrumentation*.ts",
        "src/env.ts",
      ],
    },
    include: ["__tests__/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "dist", "coverage"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      test: path.resolve(__dirname, "./__tests__"),
    },
  },
});
