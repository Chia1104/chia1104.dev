import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: [
      "src/**/*.{spec,test}.{ts,tsx,mts}",
      "__tests__/**/*.{spec,test}.{ts,tsx,mts}",
    ],
    exclude: ["**/node_modules/**"],
  },
});
