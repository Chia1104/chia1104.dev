import { existsSync } from "node:fs";

import type { Config } from "drizzle-kit";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";

import * as agent from "./src/schemas/agent.schema.ts";

const envFile = new URL("../../.env.global", import.meta.url);
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const dbEnv = (
  env = process.env.VERCEL_ENV ?? process.env.ENV ?? process.env.NODE_ENV
) => {
  switch (env) {
    case "production":
    case "prod": {
      if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not set");
      }
      return process.env.DATABASE_URL;
    }
    case "preview":
    case "beta": {
      if (!process.env.BETA_DATABASE_URL) {
        throw new Error("BETA_DATABASE_URL is not set");
      }
      return process.env.BETA_DATABASE_URL;
    }
    case "development":
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

/** `tablesFilter` matches bare names across schemas, so unprefixed `agent` tables must be listed beside the `chia_*` glob. */
const agentTables = Object.values(agent)
  .filter((value) => is(value, PgTable))
  .map((table) => getTableName(table));

export default {
  schema: "./src/schemas/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbEnv(),
  },
  out: "./.drizzle/migrations",
  schemaFilter: ["public", "agent"],
  tablesFilter: ["chia_*", ...agentTables],
} satisfies Config;
