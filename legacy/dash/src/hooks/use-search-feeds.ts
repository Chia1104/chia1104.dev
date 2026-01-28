import type { UseMutationOptions } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import type { InferResponseType } from "hono";

import type { Locale } from "@chia/db/types";

import type { client } from "@/libs/service/client";
import { searchFeeds } from "@/resources/feed.resource";

type UseSearchFeedsOptions = UseMutationOptions<
  InferResponseType<typeof client.api.v1.feeds.search.$get, 200>,
  Error,
  { query: string; locale?: Locale }
>;

export const useSearchFeeds = (options?: UseSearchFeedsOptions) => {
  return useMutation({
    mutationFn: ({ query, locale }) => searchFeeds(query, locale),
    ...options,
  });
};
