import FeedList from "./feed-list";
import { db } from "@chia/db";
import { postRouter } from "@chia/api/src/routes/post";
import { auth } from "@chia/auth";

const getPosts = async () => {
  const session = await auth();
  const postCaller = postRouter.createCaller({
    session,
    db,
  });
  return await postCaller.infinite({
    limit: 10,
    orderBy: "id",
    sortOrder: "desc",
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
        query={{ limit: 10, orderBy: "id", sortOrder: "desc" }}
      />
    </div>
  );
};

export default FeedPage;
