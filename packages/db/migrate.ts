import { migrate } from "drizzle-orm/postgres-js/migrator";

import { getDB, closeClient } from "./src";

const run = async () => {
  await migrate(getDB(), {
    migrationsFolder: "./.drizzle/migrations",
  });

  await closeClient();
};

run().catch(console.error);
