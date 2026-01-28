import "server-only";

import { ViewTransition } from "react";

import FeedList from "@/components/feed/feed-list";

export const dynamic = "force-dynamic";

const NotesPage = () => (
  <ViewTransition>
    <FeedList
      query={{
        limit: 10,
        orderBy: "createdAt",
        sortOrder: "desc",
        type: "note",
      }}
    />
  </ViewTransition>
);

export default NotesPage;
