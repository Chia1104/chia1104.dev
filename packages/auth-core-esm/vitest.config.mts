import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    passWithNoTests: true,
    setupFiles: ["../../toolings/vitest/setup.ts"],
    env: {
      DATABASE_URL: "postgres://postgres:password@localhost:5432/auth",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      AUTH_SECRET: "auth-secret",
    },
  },
});
