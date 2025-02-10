import "server-only";

import FeedList from "@/components/feed/feed-list";

export const dynamic = "force-dynamic";

const FeedPage = () => {
  return (
    <>
      <FeedList
        query={{ limit: 10, orderBy: "id", sortOrder: "desc", type: "note" }}
      />
    </>
  );
};

export default FeedPage;
