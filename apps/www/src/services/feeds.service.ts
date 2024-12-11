import { cache } from "react";

import { unstable_cache as nextCache } from "next/cache";
import "server-only";

import { api } from "@/trpc/rsc";

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

export const getPosts = (limit = 10) =>
  cache(
    nextCache(
      async () =>
        await api.feeds.getFeedsWithMetaByAdminId({
          limit: limit.toString(),
          type: "post",
          published: "true",
          orderBy: "id",
          sortOrder: "desc",
        }),
      FEEDS_CACHE_TAGS.getPosts(limit),
      {
        revalidate: 60,
        tags: FEEDS_CACHE_TAGS.getPosts(limit),
      }
    )
  )();

export const getPostBySlug = (slug: string) =>
  cache(
    nextCache(
      async () => await api.feeds.getFeedBySlug({ slug }),
      FEEDS_CACHE_TAGS.getPostBySlug(slug),
      {
        revalidate: 60,
        tags: FEEDS_CACHE_TAGS.getPostBySlug(slug),
      }
    )
  )();

export const getNotes = (limit = 10) =>
  cache(
    nextCache(
      async () =>
        await api.feeds.getFeedsWithMetaByAdminId({
          limit: limit.toString(),
          type: "note",
          published: "true",
          orderBy: "id",
          sortOrder: "desc",
        }),
      FEEDS_CACHE_TAGS.getNotes(limit),
      {
        revalidate: 60,
        tags: FEEDS_CACHE_TAGS.getNotes(limit),
      }
    )
  )();

export const getNoteBySlug = (slug: string) =>
  cache(
    nextCache(
      async () => await api.feeds.getFeedBySlug({ slug }),
      FEEDS_CACHE_TAGS.getNoteBySlug(slug),
      {
        revalidate: 60,
        tags: FEEDS_CACHE_TAGS.getNoteBySlug(slug),
      }
    )
  )();
