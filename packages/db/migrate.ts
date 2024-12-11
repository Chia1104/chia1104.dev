import { migrate } from "drizzle-orm/postgres-js/migrator";

import { getDB } from "./src";

const run = async () => {
  await migrate(getDB(), {
    migrationsFolder: "./.drizzle/migrations",
  });
};

run().catch(console.error);
