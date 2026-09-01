import { nodeConfig } from "@chia/test/config";

export default nodeConfig({
  test: {
    env: {
      DATABASE_URL: "postgres://postgres:password@localhost:5432/auth",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      AUTH_SECRET: "auth-secret",
    },
  },
});
