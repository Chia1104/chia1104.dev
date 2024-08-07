import "server-only";

import { feedsRouter } from "@chia/api/trpc/routes/feeds";
import { auth } from "@chia/auth";
import type { Session } from "@chia/auth";
import { db, localDb, betaDb } from "@chia/db";
import { getDb } from "@chia/utils";

import FeedList from "../feed-list";

const getNotes = async (session: Session | null) => {
  const feedsCaller = feedsRouter.createCaller({
    session,
    db: getDb(undefined, {
      db,
      localDb,
      betaDb,
    }),
  });
  return await feedsCaller.infinite({
    limit: 10,
    orderBy: "id",
    sortOrder: "desc",
    type: "note",
  });
};

export const dynamic = "force-dynamic";

const FeedPage = async () => {
  const session = await auth();
  const notes = await getNotes(session);
  return (
    <FeedList
      title="Notes"
      initFeed={notes.items}
      nextCursor={notes.nextCursor}
      query={{ limit: 10, orderBy: "id", sortOrder: "desc", type: "note" }}
    />
  );
};

export default FeedPage;
