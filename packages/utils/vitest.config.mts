import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    passWithNoTests: true,
    setupFiles: ["../../toolings/vitest/setup.ts"],
  },
});
