import type { FactoryProvider } from "@nestjs/commons";

import { db, localDb, betaDb } from "@chia/db";
import { getDb } from "@chia/utils";

export const DRIZZLE_PROVIDER = "DRIZZLE_PROVIDER";

export default {
  provide: DRIZZLE_PROVIDER,
  useFactory: () => {
    return getDb(undefined, {
      db,
      betaDb,
      localDb,
    });
  },
} satisfies FactoryProvider;
