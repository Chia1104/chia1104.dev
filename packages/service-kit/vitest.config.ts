import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.{spec,test}.ts", "__tests__/**/*.{spec,test}.ts"],
    exclude: ["**/node_modules/**"],
  },
});
