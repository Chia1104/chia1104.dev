import "server-only";

import FeedList from "@/components/feed/feed-list";

export const dynamic = "force-dynamic";

const FeedPage = () => (
  <FeedList
    query={{ limit: 10, orderBy: "createdAt", sortOrder: "desc", type: "post" }}
  />
);

export default FeedPage;
