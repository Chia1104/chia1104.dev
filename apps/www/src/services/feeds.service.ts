import { cache } from "react";

import "server-only";

import type { ExternalRouterOutputs } from "@chia/api";
import { serviceRequest } from "@chia/utils";

import { env } from "@/env";

// import { api } from "@/trpc/rsc";

type FeedsWithMeta =
  ExternalRouterOutputs["feeds"]["getFeedsWithMetaByAdminId"];

type Feed = ExternalRouterOutputs["feeds"]["getFeedBySlug"];

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

export const getPosts = cache(async (limit = 10) => {
  // return await api.feeds.getFeedsWithMetaByAdminId({
  //   limit: limit.toString(),
  //   type: "post",
  //   published: "true",
  //   orderBy: "id",
  //   sortOrder: "desc",
  // })
  return serviceRequest({
    isInternal: true,
    internal_requestSecret: env.INTERNAL_REQUEST_SECRET,
  })
    .get(`admin/public/feeds`, {
      searchParams: {
        limit: limit.toString(),
        type: "post",
        published: "true",
        orderBy: "id",
        sortOrder: "desc",
      },
      next: { revalidate: 60 },
    })
    .json<FeedsWithMeta>();
});

export const getPostBySlug = cache(async (slug: string) => {
  // return await api.feeds.getFeedBySlug({ slug })
  return serviceRequest({
    isInternal: true,
    internal_requestSecret: env.INTERNAL_REQUEST_SECRET,
    next: { revalidate: 60 },
  })
    .get(`admin/public/feeds/${slug}`)
    .json<Feed>();
});

export const getNotes = cache(async (limit = 10) => {
  // return await api.feeds.getFeedsWithMetaByAdminId({
  //   limit: limit.toString(),
  //   type: "note",
  //   published: "true",
  //   orderBy: "id",
  //   sortOrder: "desc",
  // })
  return serviceRequest({
    isInternal: true,
    internal_requestSecret: env.INTERNAL_REQUEST_SECRET,
  })
    .get(`admin/public/feeds`, {
      searchParams: {
        limit: limit.toString(),
        type: "note",
        published: "true",
        orderBy: "id",
        sortOrder: "desc",
      },
      next: { revalidate: 60 },
    })
    .json<FeedsWithMeta>();
});

export const getNoteBySlug = cache(async (slug: string) => {
  // return await api.feeds.getFeedBySlug({ slug })
  return serviceRequest({
    isInternal: true,
    internal_requestSecret: env.INTERNAL_REQUEST_SECRET,
    next: { revalidate: 60 },
  })
    .get(`admin/public/feeds/${slug}`)
    .json<Feed>();
});
