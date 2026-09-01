import { pgSchema, pgTableCreator } from "drizzle-orm/pg-core";

export const pgTable = pgTableCreator((name) => `chia_${name}`);

/** Agent tables live in the `agent` schema and are unprefixed. */
export const agentSchema = pgSchema("agent");
