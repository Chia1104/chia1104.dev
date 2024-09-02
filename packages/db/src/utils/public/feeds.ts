import { withDTO } from "../";
import { schema, eq, count } from "../..";

export const getPublicFeedsTotal = withDTO(async (db, userID: string) => {
  return (
    await db
      .select({ count: count(schema.feeds.published) })
      .from(schema.feeds)
      .where(eq(schema.feeds.userId, userID))
  )[0].count;
});
