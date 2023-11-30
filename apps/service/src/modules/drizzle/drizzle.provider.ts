import { db, localDb, betaDb } from "@chia/db";
import { FactoryProvider } from "@nestjs/common";
import { getDb } from "@chia/utils";

export const DRIZZLE_PROVIDER = "DRIZZLE_PROVIDER";

export default {
  provide: DRIZZLE_PROVIDER,
  useFactory: async () => {
    return getDb(undefined, {
      db,
      betaDb,
      localDb,
    });
  },
} satisfies FactoryProvider;
