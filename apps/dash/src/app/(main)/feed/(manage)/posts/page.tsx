import "server-only";

import FeedList from "../feed-list";

export const dynamic = "force-dynamic";

const FeedPage = () => {
  return (
    <FeedList
      title="Posts"
      query={{ limit: 10, orderBy: "id", sortOrder: "desc", type: "post" }}
    />
  );
};

export default FeedPage;
