import "server-only";

import { feedsRouter } from "@chia/api/trpc";
import { auth } from "@chia/auth";
import type { Session } from "@chia/auth";
import { getDB } from "@chia/db";

import FeedList from "../feed-list";

const getPosts = async (session: Session | null) => {
  const feedsCaller = feedsRouter.createCaller({
    session,
    db: getDB(),
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
