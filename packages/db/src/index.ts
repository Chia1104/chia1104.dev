import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export const queryClient = postgres(process.env.DATABASE_URL);

export const localQueryClient = postgres(process.env.LOCAL_DATABASE_URL ?? "");

export const betaQueryClient = postgres(process.env.BETA_DATABASE_URL ?? "");

export const db: DB = drizzle(queryClient, {
  schema,
});

export const localDb: DB = drizzle(localQueryClient, {
  schema,
});

export const betaDb: DB = drizzle(betaQueryClient, {
  schema,
});

export type DB = PostgresJsDatabase<typeof schema>;

export { schema };
export * from "drizzle-orm";
export { pgTable as tableCreator } from "./schema/table";

export * from "./utils/feeds";
