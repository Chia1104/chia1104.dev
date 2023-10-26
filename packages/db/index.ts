import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// for migrations
export const migrationClient = postgres(process.env.DATABASE_URL, { max: 1 });

// for query purposes
export const queryClient = postgres(process.env.DATABASE_URL);
export const db = drizzle(queryClient);

export * from "drizzle-orm";
export * as schema from "./schema";
export { pgTable as tableCreator } from "./schema/table";
