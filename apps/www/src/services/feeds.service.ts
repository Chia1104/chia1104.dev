import { cache } from "react";

import "server-only";

import { api } from "@/trpc/rsc";

/**
 * @deprecated
 */
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

export const getPosts = cache(
  async (limit = 10) =>
    await api.feeds.getFeedsWithMetaByAdminId({
      limit: limit.toString(),
      type: "post",
      published: "true",
      orderBy: "id",
      sortOrder: "desc",
    })
);

export const getPostBySlug = cache(
  async (slug: string) => await api.feeds.getFeedBySlug({ slug })
);

export const getNotes = cache(
  async (limit = 10) =>
    await api.feeds.getFeedsWithMetaByAdminId({
      limit: limit.toString(),
      type: "note",
      published: "true",
      orderBy: "id",
      sortOrder: "desc",
    })
);

export const getNoteBySlug = cache(
  async (slug: string) => await api.feeds.getFeedBySlug({ slug })
);
