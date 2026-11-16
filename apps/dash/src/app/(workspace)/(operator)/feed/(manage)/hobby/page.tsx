import "server-only";
import { ViewTransition } from "react";

import FeedList from "@/components/feed/feed-list";

export const dynamic = "force-dynamic";

const HobbyPage = () => (
  <ViewTransition>
    <FeedList
      query={{
        limit: 10,
        orderBy: "createdAt",
        sortOrder: "desc",
        mode: "hobby",
      }}
    />
  </ViewTransition>
);

export default HobbyPage;
