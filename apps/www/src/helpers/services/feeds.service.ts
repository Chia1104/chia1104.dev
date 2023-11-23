import "server-only";
import { feedsRouter } from "@chia/api/src/routes/feeds";
import { db } from "@chia/db";
import { auth } from "@chia/auth";
import { unstable_cache as cache } from "next/cache";

export const keys = {
  posts: (limit: number) => ["ADMIN_ISR_POSTS", limit.toString()],
  notes: (limit: number) => ["ADMIN_ISR_NOTES", limit.toString()],
};

export const getPosts = (limit = 10) =>
  cache(
    async () => {
      const session = await auth();
      const postCaller = feedsRouter.createCaller({
        db,
        session,
      });
      return await postCaller.infinite({
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
      const postCaller = feedsRouter.createCaller({
        db,
        session,
      });
      return await postCaller.infinite({
        limit: 4,
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
