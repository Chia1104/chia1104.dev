import { isHTTPError } from "ky";
import "server-only";

import {
  getFeedBySlug as _getFeedBySlug,
  getFeedsWithMetaByAdminId,
} from "@chia/api/services/feeds";
import type { FeedType } from "@chia/db/types";

import { env } from "@/env";

export const getPosts = async (limit = 10) => {
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
    }
  );
};

export const getNotes = async (limit = 10) => {
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
    }
  );
};

export const getFeedsWithType = async (
  type: Exclude<FeedType, "all">,
  limit = 10
) => {
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
    }
  );
};

export const getFeeds = async (limit = 10) => {
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
    }
  );
};

export const getFeedBySlug = async (slug: string, _locale?: Locale) => {
  try {
    return await _getFeedBySlug(
      {
        cfBypassToken: env.CF_BYPASS_TOKEN,
        apiKey: env.CH_API_KEY ?? "",
      },
      { slug }
    );
  } catch (error) {
    if (isHTTPError(error) && error.response.status === 404) {
      return null;
    }
    throw error;
  }
};
