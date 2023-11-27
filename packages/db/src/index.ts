import "dotenv/config";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export const queryClient = postgres(process.env.DATABASE_URL);

export const localQueryClient = postgres(process.env.LOCAL_DATABASE_URL!);

export const db = drizzle(queryClient, {
  schema,
});

export const localDb = drizzle(localQueryClient, {
  schema,
});

export type DB = PostgresJsDatabase<typeof schema>;

export { schema };
export * from "drizzle-orm";
export { pgTable as tableCreator } from "./schema/table";

export * from "./utils/feeds";
