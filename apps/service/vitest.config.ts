import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: [
      "src/**/*.{spec,test}.{ts,tsx}",
      "__tests__/**/*.{spec,test}.{ts,tsx}",
    ],
    exclude: ["**/node_modules/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      test: path.resolve(__dirname, "./__tests__"),
    },
  },
});
