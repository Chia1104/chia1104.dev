import { migrate } from "drizzle-orm/node-postgres/migrator";

import { getDB } from "./src";

const run = async () => {
  await migrate(getDB(), {
    migrationsFolder: "./.drizzle/migrations",
  });
};

run().catch(console.error);
