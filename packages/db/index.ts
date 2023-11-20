import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export const queryClient = postgres(process.env.DATABASE_URL!);

export const db = drizzle(queryClient, {
  schema,
});

export { schema };
export * from "drizzle-orm";
export { pgTable as tableCreator } from "./schema/table";
