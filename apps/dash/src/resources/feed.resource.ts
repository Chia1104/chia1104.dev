import type { InferResponseType, InferRequestType } from "hono";

import { Locale } from "@chia/db/types";

import { client } from "@/libs/service/client";
import { HonoRPCError } from "@/libs/service/error";

export type FeedSearchResult = InferResponseType<
  typeof client.api.v1.feeds.search.$get,
  200
>;

export type FeedSearchRequest = InferRequestType<
  typeof client.api.v1.feeds.search.$get
>["query"];

export const searchFeeds = async (
  query: string,
  locale: Locale = Locale.zhTW,
  model?: FeedSearchRequest["model"]
) => {
  try {
    const response = await client.api.v1.feeds.search.$get({
      query: {
        keyword: query,
        locale,
        model: model ?? "text-embedding-3-small",
      },
    });
    if (!response.ok) {
      throw new HonoRPCError(
        response.statusText,
        response.status,
        response.statusText
      );
    }
    return response.json();
  } catch (error) {
    if (error instanceof HonoRPCError) {
      throw error;
    }
    throw new HonoRPCError("unknown error", 500, "unknown error");
  }
};
