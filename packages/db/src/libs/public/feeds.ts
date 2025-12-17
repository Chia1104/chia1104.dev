import { eq } from "drizzle-orm";
import { count } from "drizzle-orm";

import { withDTO } from "../";
import { schema } from "../..";

export const getPublicFeedsTotal = withDTO(async (db, userID: string) => {
  return (
    await db
      .select({ count: count(schema.feeds.published) })
      .from(schema.feeds)
      .where(eq(schema.feeds.userId, userID))
  )[0]?.count;
});
