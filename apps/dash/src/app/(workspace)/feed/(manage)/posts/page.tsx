import "server-only";

import { ViewTransition } from "react";

import FeedList from "@/components/feed/feed-list";

export const dynamic = "force-dynamic";

const PostsPage = () => (
  <ViewTransition>
    <FeedList
      query={{
        limit: 10,
        orderBy: "createdAt",
        sortOrder: "desc",
        type: "post",
      }}
    />
  </ViewTransition>
);

export default PostsPage;
