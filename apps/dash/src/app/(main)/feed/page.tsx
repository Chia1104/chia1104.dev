import FeedList from "./feed-list";
import { db, localDb, betaDb } from "@chia/db";
import { feedsRouter } from "@chia/api/src/routes/feeds";
import { auth } from "@chia/auth";
import { getDb } from "@chia/utils";

const getPosts = async () => {
  const session = await auth();
  const feedsCaller = feedsRouter.createCaller({
    session,
    db: getDb(undefined, {
      db,
      localDb,
      betaDb,
    }),
  });
  return await feedsCaller.infinite({
    limit: 10,
    orderBy: "id",
    sortOrder: "desc",
    type: "post",
  });
};

export const dynamic = "force-dynamic";

const FeedPage = async () => {
  const posts = await getPosts();
  return (
    <div className="c-container main mt-24">
      <FeedList
        initFeed={posts.items}
        nextCursor={posts.nextCursor}
        query={{ limit: 10, orderBy: "id", sortOrder: "desc", type: "post" }}
      />
    </div>
  );
};

export default FeedPage;
