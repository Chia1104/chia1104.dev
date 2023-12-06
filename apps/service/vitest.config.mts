import { defineConfig } from "vitest/config";
import path from "path";
import swc from "unplugin-swc";

export default defineConfig({
  test: {
    environment: "node",
    passWithNoTests: true,
    setupFiles: ["../../toolings/vitest/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [swc.vite()],
});
