import "server-only";

import FeedList from "@/components/feed/feed-list";

export const dynamic = "force-dynamic";

const FeedPage = () => {
  return (
    <>
      <h2 className="mb-10 text-4xl">Posts</h2>
      <FeedList
        query={{ limit: 10, orderBy: "id", sortOrder: "desc", type: "post" }}
      />
    </>
  );
};

export default FeedPage;
