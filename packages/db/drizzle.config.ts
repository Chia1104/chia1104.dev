import * as dotenv from "dotenv";
import type { Config } from "drizzle-kit";

dotenv.config({
  path: "../../.env.global",
});

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const dbEnv = (env = process.env.VERCEL_ENV ?? process.env.NODE_ENV) => {
  switch (env) {
    case "production":
    case "prod": {
      if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not set");
      }
      return process.env.DATABASE_URL;
    }
    case "development":
    case "preview":
    case "beta": {
      if (!process.env.BETA_DATABASE_URL) {
        throw new Error("BETA_DATABASE_URL is not set");
      }
      return process.env.BETA_DATABASE_URL;
    }
    case "local": {
      if (!process.env.LOCAL_DATABASE_URL) {
        throw new Error("LOCAL_DATABASE_URL is not set");
      }
      return process.env.LOCAL_DATABASE_URL;
    }
    default:
      throw new Error(`Unknown env: ${env}`);
  }
};

export default {
  schema: "./src/schema",
  driver: "pg",
  dbCredentials: {
    connectionString: dbEnv(),
  },
  out: "./.drizzle",
  tablesFilter: ["chia_*"],
} satisfies Config;
