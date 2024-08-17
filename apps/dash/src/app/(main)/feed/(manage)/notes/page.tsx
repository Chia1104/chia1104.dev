import "server-only";

import FeedList from "../feed-list";

export const dynamic = "force-dynamic";

const FeedPage = () => {
  return (
    <>
      <h2 className="mb-10 text-4xl">Notes</h2>
      <FeedList
        query={{ limit: 10, orderBy: "id", sortOrder: "desc", type: "note" }}
      />
    </>
  );
};

export default FeedPage;
