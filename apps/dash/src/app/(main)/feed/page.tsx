import FeedList from "./feed-list";
import { db, localDb, betaDb } from "@chia/db";
import { feedsRouter } from "@chia/api/trpc/routes/feeds";
import { auth, type Session } from "@chia/auth";
import { getDb } from "@chia/utils";

const getPosts = async (session: Session | null) => {
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
  const session = await auth();
  if (!session) {
    return (
      <div className="c-container main">
        <div className="text-center">
          <h1 className="text-3xl font-bold">401</h1>
          <p className="text-xl font-bold">You are not logged in.</p>
        </div>
      </div>
    );
  }
  const posts = await getPosts(session);
  return (
    <article className="c-container main mt-24">
      <FeedList
        initFeed={posts.items}
        nextCursor={posts.nextCursor}
        query={{ limit: 10, orderBy: "id", sortOrder: "desc", type: "post" }}
      />
    </article>
  );
};

export default FeedPage;
