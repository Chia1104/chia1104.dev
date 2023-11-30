import "server-only";
import { feedsRouter } from "@chia/api/src/routes/feeds";
import { db, localDb, betaDb } from "@chia/db";
import { auth } from "@chia/auth";
import { unstable_cache as cache } from "next/cache";
import { getDb } from "@chia/utils";

export const keys = {
  posts: (limit: number) => ["ADMIN_ISR_POSTS", limit.toString()],
  notes: (limit: number) => ["ADMIN_ISR_NOTES", limit.toString()],
};

const database = getDb(undefined, {
  db,
  localDb,
  betaDb,
});

export const getPosts = (limit = 10) =>
  cache(
    async () => {
      const session = await auth();
      const feedsCaller = feedsRouter.createCaller({
        db: database,
        session,
      });
      return await feedsCaller.infinityByAdmin({
        limit,
        orderBy: "id",
        sortOrder: "desc",
        type: "post",
      });
    },
    keys.posts(limit),
    {
      revalidate: 60,
      tags: keys.posts(limit),
    }
  )();

export const getNotes = (limit = 10) =>
  cache(
    async () => {
      const session = await auth();
      const feedsCaller = feedsRouter.createCaller({
        db: database,
        session,
      });
      return await feedsCaller.infinityByAdmin({
        limit,
        orderBy: "id",
        sortOrder: "desc",
        type: "note",
      });
    },
    keys.notes(limit),
    {
      revalidate: 60,
      tags: keys.notes(limit),
    }
  )();
