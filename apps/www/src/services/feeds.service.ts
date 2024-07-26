import "server-only";
import {
  db,
  localDb,
  betaDb,
  getInfiniteFeedsByUserId,
  eq,
  schema,
  getFeedBySlug,
} from "@chia/db";
import { unstable_cache as cache } from "next/cache";
import { getDb, getAdminId } from "@chia/utils";

export const keys = {
  posts: (limit: number) => ["ADMIN_ISR_POSTS", limit.toString()],
  notes: (limit: number) => ["ADMIN_ISR_NOTES", limit.toString()],
  post: (slug: string) => ["ADMIN_ISR_POST", slug],
  note: (slug: string) => ["ADMIN_ISR_NOTE", slug],
};

const database = getDb(undefined, {
  db,
  localDb,
  betaDb,
});

const adminId = getAdminId();

export const getPosts = (limit = 10) =>
  cache(
    async () => {
      return await getInfiniteFeedsByUserId(database, {
        userId: adminId,
        limit,
        orderBy: "id",
        sortOrder: "desc",
        type: "post",
        whereAnd: [eq(schema.feeds.published, true)],
      });
    },
    keys.posts(limit),
    {
      revalidate: 60,
      tags: keys.posts(limit),
    }
  )();

export const getPostBySlug = (slug: string, type?: "post" | "note") =>
  cache(
    async () => {
      return await getFeedBySlug(database, {
        slug,
        type: type ?? "post",
      });
    },
    keys.post(slug),
    {
      revalidate: 60,
      tags: keys.post(slug),
    }
  )();

export const getNotes = (limit = 10) =>
  cache(
    async () => {
      return await getInfiniteFeedsByUserId(database, {
        userId: adminId,
        limit,
        orderBy: "id",
        sortOrder: "desc",
        type: "note",
        whereAnd: [eq(schema.feeds.published, true)],
      });
    },
    keys.notes(limit),
    {
      revalidate: 60,
      tags: keys.notes(limit),
    }
  )();
