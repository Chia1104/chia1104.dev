import { isHTTPError } from "ky";
import "server-only";

import {
  getFeedBySlug as _getFeedBySlug,
  getFeedsWithMetaByAdminId,
} from "@chia/api/services/feeds";
import { Locale } from "@chia/db/types";
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
      locale: Locale.zhTW,
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
      locale: Locale.zhTW,
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
      locale: Locale.zhTW,
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
      locale: Locale.zhTW,
    }
  );
};

export const getFeedBySlug = async (slug: string, locale = Locale.zhTW) => {
  try {
    return await _getFeedBySlug(
      {
        cfBypassToken: env.CF_BYPASS_TOKEN,
        apiKey: env.CH_API_KEY ?? "",
      },
      { slug, locale }
    );
  } catch (error) {
    if (isHTTPError(error) && error.response.status === 404) {
      return null;
    }
    throw error;
  }
};
