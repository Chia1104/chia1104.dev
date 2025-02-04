import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

export { schema };
export * from "drizzle-orm";
export { pgTable as tableCreator } from "./schema/table";

export * from "./schema/enums";
