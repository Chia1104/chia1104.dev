import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    passWithNoTests: true,
    setupFiles: [
      "../../toolings/vitest/setup.ts",
      "__tests__/setup.ts",
      "dotenv/config",
    ],
  },
});
