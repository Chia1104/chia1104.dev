import "server-only";

import {
  getFeedBySlug,
  getFeedsWithMetaByAdminId,
} from "@chia/api/services/feeds";

import { env } from "@/env";

export const FEEDS_CACHE_TAGS = {
  getPosts: (limit: number) => [
    "ADMIN_FEEDS_ISR",
    "getPosts",
    limit.toString(),
  ],
  getPostBySlug: (slug: string) => ["ADMIN_FEEDS_ISR", "getPostBySlug", slug],
  getNotes: (limit: number) => [
    "ADMIN_FEEDS_ISR",
    "getNotes",
    limit.toString(),
  ],
  getNoteBySlug: (slug: string) => ["ADMIN_FEEDS_ISR", "getNoteBySlug", slug],
};

export const getPosts = async (limit = 10) => {
  return await getFeedsWithMetaByAdminId(
    env.INTERNAL_REQUEST_SECRET,
    {
      limit,
      type: "post",
      published: "true",
      orderBy: "id",
      sortOrder: "desc",
      withContent: "false",
    }
    // {
    //   next: {
    //     revalidate: 60,
    //     tags: FEEDS_CACHE_TAGS.getPosts(limit),
    //   },
    // }
  );
};

export const getPostBySlug = async (slug: string) => {
  return await getFeedBySlug(
    env.INTERNAL_REQUEST_SECRET,
    { slug }
    // {
    //   next: {
    //     revalidate: 60,
    //     tags: FEEDS_CACHE_TAGS.getPostBySlug(slug),
    //   },
    // }
  );
};

export const getNotes = async (limit = 10) => {
  return await getFeedsWithMetaByAdminId(
    env.INTERNAL_REQUEST_SECRET,
    {
      limit,
      type: "note",
      published: "true",
      orderBy: "id",
      sortOrder: "desc",
      withContent: "false",
    }
    // {
    //   next: {
    //     revalidate: 60,
    //     tags: FEEDS_CACHE_TAGS.getNotes(limit),
    //   },
    // }
  );
};

export const getNoteBySlug = async (slug: string) => {
  return await getFeedBySlug(
    env.INTERNAL_REQUEST_SECRET,
    { slug }
    // {
    //   next: {
    //     revalidate: 60,
    //     tags: FEEDS_CACHE_TAGS.getNoteBySlug(slug),
    //   },
    // }
  );
};
