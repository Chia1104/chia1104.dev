import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "./schemas";

export type DB = NodePgDatabase<typeof schema>;

export { schema };
export { pgTable as tableCreator } from "./schemas/table";

export * from "./schemas/enums";
