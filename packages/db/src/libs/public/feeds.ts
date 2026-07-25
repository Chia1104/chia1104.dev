import { and, eq, isNull } from "drizzle-orm";
import { count } from "drizzle-orm";

import { withDTO } from "../";
import { schema } from "../..";

/**
 * Number of feeds the public site may show.
 *
 * `count(feeds.published)` counted every row — `published` is a NOT NULL boolean, so
 * non-null is always true — which meant the public count included unpublished drafts and
 * soft-deleted feeds.
 */
export const getPublicFeedsTotal = withDTO(async (db, userID: string) => {
  return (
    await db
      .select({ count: count() })
      .from(schema.feeds)
      .where(
        and(
          eq(schema.feeds.userId, userID),
          eq(schema.feeds.published, true),
          isNull(schema.feeds.deletedAt)
        )
      )
  )[0]?.count;
});
