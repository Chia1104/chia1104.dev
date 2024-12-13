import { migrate } from "drizzle-orm/node-postgres/migrator";

import { connectDatabase } from "./src/client";

const run = async () => {
  await migrate(await connectDatabase(), {
    migrationsFolder: "./.drizzle/migrations",
  });
};

run().catch(console.error);
