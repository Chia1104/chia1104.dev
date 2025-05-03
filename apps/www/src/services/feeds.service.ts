import { captureException } from "@sentry/nextjs";
import { HTTPError } from "ky";
import "server-only";

import {
  getFeedBySlug as _getFeedBySlug,
  getFeedsWithMetaByAdminId,
} from "@chia/api/services/feeds";
import type { FeedType } from "@chia/db/types";

import { env } from "@/env";

export const FEEDS_CACHE_TAGS = {
  getPosts: (limit: number) => [
    "ADMIN_FEEDS_ISR",
    "getPosts",
    limit.toString(),
  ],
  getNotes: (limit: number) => [
    "ADMIN_FEEDS_ISR",
    "getNotes",
    limit.toString(),
  ],
  getFeedsWithType: (type: "post" | "note", limit: number) => [
    "ADMIN_FEEDS_ISR",
    "getFeedsWithType",
    type,
    limit.toString(),
  ],
  getFeeds: (limit: number) => [
    "ADMIN_FEEDS_ISR",
    "getFeeds",
    limit.toString(),
  ],
  getFeedBySlug: (slug: string) => ["ADMIN_FEEDS_ISR", "getFeedBySlug", slug],
};

export const getPosts = async (limit = 10) => {
  try {
    return await getFeedsWithMetaByAdminId(
      {
        cfBypassToken: env.CF_BYPASS_TOKEN,
        apiKey: env.CH_API_KEY ?? "",
      },
      {
        limit,
        type: "post",
        published: "true",
        orderBy: "id",
        sortOrder: "desc",
        withContent: "false",
      },
      {
        next: { tags: FEEDS_CACHE_TAGS.getPosts(limit) },
      }
    );
  } catch (error) {
    captureException(error);
    throw error;
  }
};

export const getNotes = async (limit = 10) => {
  try {
    return await getFeedsWithMetaByAdminId(
      {
        cfBypassToken: env.CF_BYPASS_TOKEN,
        apiKey: env.CH_API_KEY ?? "",
      },
      {
        limit,
        type: "note",
        published: "true",
        orderBy: "id",
        sortOrder: "desc",
        withContent: "false",
      },
      {
        next: { tags: FEEDS_CACHE_TAGS.getNotes(limit) },
      }
    );
  } catch (error) {
    captureException(error);
    throw error;
  }
};

export const getFeedsWithType = async (
  type: Exclude<FeedType, "all">,
  limit = 10
) => {
  try {
    return await getFeedsWithMetaByAdminId(
      {
        cfBypassToken: env.CF_BYPASS_TOKEN,
        apiKey: env.CH_API_KEY ?? "",
      },
      {
        limit,
        type,
        published: "true",
        orderBy: "id",
        sortOrder: "desc",
        withContent: "false",
      },
      {
        next: { tags: FEEDS_CACHE_TAGS.getFeedsWithType(type, limit) },
      }
    );
  } catch (error) {
    captureException(error);
    throw error;
  }
};

export const getFeeds = async (limit = 10) => {
  try {
    return await getFeedsWithMetaByAdminId(
      {
        cfBypassToken: env.CF_BYPASS_TOKEN,
        apiKey: env.CH_API_KEY ?? "",
      },
      {
        limit,
        type: "all",
        published: "true",
        orderBy: "id",
        sortOrder: "desc",
        withContent: "false",
      },
      {
        next: { tags: FEEDS_CACHE_TAGS.getFeeds(limit) },
      }
    );
  } catch (error) {
    captureException(error);
    throw error;
  }
};

export const getFeedBySlug = async (slug: string) => {
  try {
    return await _getFeedBySlug(
      {
        cfBypassToken: env.CF_BYPASS_TOKEN,
        apiKey: env.CH_API_KEY ?? "",
      },
      { slug },
      {
        next: { tags: FEEDS_CACHE_TAGS.getFeedBySlug(slug) },
      }
    );
  } catch (error) {
    if (error instanceof HTTPError && error.response.status === 404) {
      return null;
    }
    captureException(error);
    throw error;
  }
};
