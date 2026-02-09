import "server-only";

import type { Locale } from "@chia/db/types";
import type { FeedType } from "@chia/db/types";

import { env } from "@/env";
import { client } from "@/libs/service/client.rsc";
import { HonoRPCError } from "@/libs/service/error";
import { dbLocaleResolver } from "@/libs/utils/i18n";

export const getPosts = async (
  limit = 10,
  locale: Locale = dbLocaleResolver(env.NEXT_PUBLIC_DEFAULT_LOCALE)
) => {
  try {
    const res = await client.api.v1.admin.public.feeds.$get({
      query: {
        limit: limit.toString(),
        type: "post",
        published: "true",
        orderBy: "createdAt",
        sortOrder: "desc",
        withContent: "false",
        locale,
      },
    });
    if (!res.ok) {
      throw new HonoRPCError(res.statusText, res.status, res.statusText);
    }
    return res.json();
  } catch (error) {
    if (error instanceof HonoRPCError) {
      throw error;
    }
    throw new HonoRPCError("unknown error", 500, "unknown error");
  }
};

export const getNotes = async (
  limit = 10,
  locale: Locale = dbLocaleResolver(env.NEXT_PUBLIC_DEFAULT_LOCALE)
) => {
  try {
    const res = await client.api.v1.admin.public.feeds.$get({
      query: {
        limit: limit.toString(),
        type: "note",
        published: "true",
        orderBy: "createdAt",
        sortOrder: "desc",
        withContent: "false",
        locale,
      },
    });
    if (!res.ok) {
      throw new HonoRPCError(res.statusText, res.status, res.statusText);
    }
    return res.json();
  } catch (error) {
    if (error instanceof HonoRPCError) {
      throw error;
    }
    throw new HonoRPCError("unknown error", 500, "unknown error");
  }
};

export const getFeedsWithType = async (
  type: Exclude<FeedType, "all">,
  limit = 10,
  locale: Locale = dbLocaleResolver(env.NEXT_PUBLIC_DEFAULT_LOCALE)
) => {
  try {
    const res = await client.api.v1.admin.public.feeds.$get({
      query: {
        limit: limit.toString(),
        type: type,
        published: "true",
        orderBy: "createdAt",
        sortOrder: "desc",
        withContent: "false",
        locale,
      },
    });
    if (!res.ok) {
      throw new HonoRPCError(res.statusText, res.status, res.statusText);
    }
    return res.json();
  } catch (error) {
    if (error instanceof HonoRPCError) {
      throw error;
    }
    throw new HonoRPCError("unknown error", 500, "unknown error");
  }
};

export const getFeeds = async (
  limit = 10,
  locale: Locale = dbLocaleResolver(env.NEXT_PUBLIC_DEFAULT_LOCALE)
) => {
  try {
    const res = await client.api.v1.admin.public.feeds.$get({
      query: {
        limit: limit.toString(),
        type: "all",
        published: "true",
        orderBy: "createdAt",
        sortOrder: "desc",
        withContent: "false",
        locale,
      },
    });
    if (!res.ok) {
      throw new HonoRPCError(res.statusText, res.status, res.statusText);
    }
    return res.json();
  } catch (error) {
    if (error instanceof HonoRPCError) {
      throw error;
    }
    throw new HonoRPCError("unknown error", 500, "unknown error");
  }
};

export const getFeedBySlug = async (
  slug: string,
  locale: Locale = dbLocaleResolver(env.NEXT_PUBLIC_DEFAULT_LOCALE)
) => {
  try {
    const res = await client.api.v1.admin.public.feeds[":slug"].$get({
      param: {
        slug,
      },
      query: {
        locale: locale,
      },
    });
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new HonoRPCError(res.statusText, res.status, res.statusText);
    }
    return res.json();
  } catch (error) {
    if (error instanceof HonoRPCError) {
      throw error;
    }
    throw new HonoRPCError("unknown error", 500, "unknown error");
  }
};
