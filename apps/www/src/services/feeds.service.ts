import { unstable_cache as cache } from "next/cache";
import "server-only";

import {
  getDB,
  getInfiniteFeedsByUserId,
  eq,
  schema,
  getFeedBySlug,
} from "@chia/db";
import { getAdminId } from "@chia/utils";

export const keys = {
  posts: (limit: number) => ["ADMIN_ISR_POSTS", limit.toString()],
  notes: (limit: number) => ["ADMIN_ISR_NOTES", limit.toString()],
  post: (slug: string) => ["ADMIN_ISR_POST", slug],
  note: (slug: string) => ["ADMIN_ISR_NOTE", slug],
};

const database = getDB();

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
        withContent: false,
      });
    },
    keys.posts(limit),
    {
      revalidate: 60,
      tags: keys.posts(limit),
    }
  )();

export const getPostBySlug = (slug: string) =>
  cache(
    async () => {
      return await getFeedBySlug(database, slug);
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
        withContent: false,
      });
    },
    keys.notes(limit),
    {
      revalidate: 60,
      tags: keys.notes(limit),
    }
  )();

export const getNoteBySlug = (slug: string) =>
  cache(
    async () => {
      return await getFeedBySlug(database, slug);
    },
    keys.note(slug),
    {
      revalidate: 60,
      tags: keys.note(slug),
    }
  )();
