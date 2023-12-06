import { defineWorkspace } from "vitest/config";

/**
 * @todo
 */
export default defineWorkspace([
  "packages/*",
  "apps/*",
  {
    test: {
      include: ["**/*.{browser}.{test,spec}.{ts,js,tsx,jsx}"],
      name: "browser",
      environment: "happy-dom",
    },
  },
  {
    test: {
      include: ["**/*.{node}.{test,spec}.{ts,js,tsx,jsx}"],
      name: "node",
      environment: "node",
    },
  },
  {
    test: {
      include: ["**/*.{test,spec}.{ts,js,tsx,jsx}"],
      name: "base",
      setupFiles: ["toolings/vitest/setup.ts"],
    },
  },
]);
