import { defineConfig } from "vitest/config";
import path from "path";
import swc from "unplugin-swc";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [swc.vite()],
});
