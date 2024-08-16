import "server-only";

import FeedList from "../feed-list";

export const dynamic = "force-dynamic";

const FeedPage = () => {
  return (
    <FeedList
      title="Notes"
      query={{ limit: 10, orderBy: "id", sortOrder: "desc", type: "note" }}
    />
  );
};

export default FeedPage;
