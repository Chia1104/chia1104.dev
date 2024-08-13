import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.e2e-spec.ts"],
    globals: true,
    alias: {
      "@": "./src",
      "@test": "./test",
    },
    root: "./",
    passWithNoTests: true,
    setupFiles: ["../../toolings/vitest/setup.ts"],
  },
  resolve: {
    alias: {
      "@": "./src",
      "@test": "./test",
    },
  },
  plugins: [swc.vite()],
});
