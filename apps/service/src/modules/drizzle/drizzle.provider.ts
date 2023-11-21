import { db, type DB } from "@chia/db";

export const DRIZZLE_PROVIDER = "DRIZZLE_PROVIDER";

export const drizzleProviders = [
  {
    provide: DRIZZLE_PROVIDER,
    useFactory: async (): Promise<DB> => {
      return db;
    },
    exports: [DRIZZLE_PROVIDER],
  },
];
