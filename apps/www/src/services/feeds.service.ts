import { cache } from "react";

import "server-only";

import { getDB, eq, schema } from "@chia/db";
import { getInfiniteFeedsByUserId, getFeedBySlug } from "@chia/db/repos/feeds";
import { getAdminId } from "@chia/utils";

const database = getDB();

const adminId = getAdminId();

/**
 * @deprecated use fetch instead
 */
export const getPosts = cache(
  async (limit = 10) =>
    await getInfiniteFeedsByUserId(database, {
      userId: adminId,
      limit,
      orderBy: "id",
      sortOrder: "desc",
      type: "post",
      whereAnd: [eq(schema.feeds.published, true)],
      withContent: false,
    })
);

/**
 * @deprecated use fetch instead
 */
export const getPostBySlug = cache(
  async (slug: string) => await getFeedBySlug(database, slug)
);

/**
 * @deprecated use fetch instead
 */
export const getNotes = cache(
  async (limit = 10) =>
    await getInfiniteFeedsByUserId(database, {
      userId: adminId,
      limit,
      orderBy: "id",
      sortOrder: "desc",
      type: "note",
      whereAnd: [eq(schema.feeds.published, true)],
      withContent: false,
    })
);

/**
 * @deprecated use fetch instead
 */
export const getNoteBySlug = cache(
  async (slug: string) => await getFeedBySlug(database, slug)
);
