import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "./schemas";
import type { relations } from "./schemas/relations";

export type DB = NodePgDatabase<typeof schema, typeof relations>;

export { schema };
export { pgTable as tableCreator } from "./schemas/table";

export * from "./schemas/enums";
