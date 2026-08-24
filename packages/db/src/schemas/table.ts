import { pgSchema, pgTableCreator } from "drizzle-orm/pg-core";

export const pgTable = pgTableCreator((name) => `chia_${name}`);

/** Everything the agent runtime persists lives in its own schema, unprefixed. */
export const agentSchema = pgSchema("agent");
