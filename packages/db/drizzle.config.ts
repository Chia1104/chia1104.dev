import * as dotenv from "dotenv";
import type { Config } from "drizzle-kit";

dotenv.config({
  path: "../../.env.global",
});

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export default {
  schema: "./src/schema",
  driver: "pg",
  dbCredentials: {
    connectionString:
      process.env.NODE_ENV === "prod"
        ? process.env.DATABASE_URL
        : process.env.LOCAL_DATABASE_URL!,
  },
  out: "./.drizzle",
  tablesFilter: ["chia_*"],
} satisfies Config;
