import type { MiddlewareHandler } from "hono";

import type { DB } from "@chia/db";

declare module "hono" {
  interface ContextVariableMap {
    DRIZZLE_ORM: DB;
  }
}

export const DRIZZLE_ORM = "DRIZZLE_ORM";

export const initDrizzleORM = (db: DB): MiddlewareHandler => {
  return async (c, next) => {
    c.set(DRIZZLE_ORM, db);
    await next();
  };
};
