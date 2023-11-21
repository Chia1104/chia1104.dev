import FeedList from "./feed-list";
import { db } from "@chia/db";
import { PostsAPI } from "@chia/db/utils/posts";
import { cache } from "react";
import { unstable_cache } from "next/cache";

const postsAPI = new PostsAPI(db);

const getPosts = unstable_cache(() =>
  postsAPI.getInfinitePosts({
    limit: 10,
    orderBy: "createdAt",
    sortOrder: "desc",
  })
);

const FeedPage = async () => {
  const posts = await getPosts();
  return (
    <div className="c-container main mt-24">
      <FeedList
        initFeed={posts.items}
        nextCursor={posts.nextCursor}
        query={{ limit: 10 }}
      />
    </div>
  );
};

export default FeedPage;
