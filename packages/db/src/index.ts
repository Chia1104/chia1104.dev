import * as _dotenv from "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { switchEnv } from "@chia/utils/config";

import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export const db: DB = drizzle(process.env.DATABASE_URL, {
  schema,
});

export const localDb: DB = drizzle(process.env.LOCAL_DATABASE_URL ?? "", {
  schema,
});

export const betaDb: DB = drizzle(process.env.BETA_DATABASE_URL ?? "", {
  schema,
});

export type DB = PostgresJsDatabase<typeof schema>;

export { schema };
export * from "drizzle-orm";
export { pgTable as tableCreator } from "./schema/table";

export * from "./schema/enums";

export const getDB = (env?: string) =>
  switchEnv(env, {
    prod: () => db,
    beta: () => betaDb,
    local: () => localDb,
  });
