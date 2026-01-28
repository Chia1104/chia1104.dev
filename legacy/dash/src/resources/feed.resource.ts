import type { InferResponseType } from "hono";

import type { Locale } from "@chia/db/types";

import { client } from "@/libs/service/client";
import { HonoRPCError } from "@/libs/service/error";

export type FeedSearchResult = InferResponseType<
  typeof client.api.v1.feeds.search.$get,
  200
>[0];

export const searchFeeds = async (query: string, locale?: Locale) => {
  try {
    const response = await client.api.v1.feeds.search.$get({
      query: {
        keyword: query,
        locale,
        model: "nomic-embed-text",
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
