import { and, eq, isNull, sql } from "drizzle-orm";

import type { DB } from "../../client.ts";
import { feeds, pageViews } from "../../schemas/schema.ts";
import type { FeedType, Locale } from "../../schemas/schema.ts";

export interface PageViewInsert {
  path: string;
  locale: Locale;
  visitor: string;
  /** The post or note `path` shows, resolved to its id in the insert itself. */
  feed?: { type: FeedType; slug: string } | null;
  referrerHost?: string | null;
  country?: string | null;
}

export const insertPageView = async (
  db: DB,
  { feed, ...input }: PageViewInsert
): Promise<void> => {
  await db.insert(pageViews).values({
    ...input,
    feedId: feed
      ? sql`(${db
          .select({ id: feeds.id })
          .from(feeds)
          .where(
            and(
              eq(feeds.slug, feed.slug),
              eq(feeds.type, feed.type),
              isNull(feeds.deletedAt)
            )
          )})`
      : null,
  });
};
