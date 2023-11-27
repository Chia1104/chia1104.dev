import { db, type DB } from "@chia/db";
import { FactoryProvider } from "@nestjs/common";

export const DRIZZLE_PROVIDER = "DRIZZLE_PROVIDER";

export default {
  provide: DRIZZLE_PROVIDER,
  useFactory: async (): Promise<DB> => {
    return db;
  },
} satisfies FactoryProvider;
