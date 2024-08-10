import "server-only";

import { feedsRouter } from "@chia/api/trpc/routes/feeds";
import { auth } from "@chia/auth";
import type { Session } from "@chia/auth";
import { db, localDb, betaDb } from "@chia/db";
import { getDb } from "@chia/utils";

import FeedList from "../feed-list";

const getPosts = async (session: Session | null) => {
  const feedsCaller = feedsRouter.createCaller({
    session,
    db: getDb(undefined, {
      db,
      localDb,
      betaDb,
    }),
  });
  return await feedsCaller.getFeedsWithMeta({
    limit: 10,
    orderBy: "id",
    sortOrder: "desc",
    type: "post",
  });
};

export const dynamic = "force-dynamic";

const FeedPage = async () => {
  const session = await auth();
  const posts = await getPosts(session);
  return (
    <FeedList
      title="Posts"
      initFeed={posts.items}
      nextCursor={posts.nextCursor}
      query={{ limit: 10, orderBy: "id", sortOrder: "desc", type: "post" }}
    />
  );
};

export default FeedPage;
