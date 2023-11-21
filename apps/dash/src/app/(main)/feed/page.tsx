import FeedList from "./feed-list";
import { db } from "@chia/db";
import { unstable_cache as cache } from "next/cache";
import { postRouter } from "@chia/api/src/routes/post";
import { auth } from "@chia/auth";

const getPosts = cache(
  async () => {
    const session = await auth();
    const postCaller = postRouter.createCaller({
      session,
      db,
    });
    return await postCaller.infinite({
      limit: 10,
      orderBy: "createdAt",
      sortOrder: "desc",
    });
  },
  ["posts-infinite"],
  {
    tags: ["posts"],
    revalidate: Infinity,
  }
);

const FeedPage = async () => {
  const posts = await getPosts();
  return (
    <div className="c-container main mt-24">
      <FeedList
        initFeed={posts.items}
        nextCursor={posts.nextCursor}
        query={{ limit: 10, orderBy: "createdAt", sortOrder: "desc" }}
      />
    </div>
  );
};

export default FeedPage;
