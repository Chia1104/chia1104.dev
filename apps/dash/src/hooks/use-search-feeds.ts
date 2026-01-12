import { useMutation } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";

import type { FeedSearchResult } from "@/resources/feed.resource";
import { searchFeeds } from "@/resources/feed.resource";

type UseSearchFeedsOptions = UseMutationOptions<
  FeedSearchResult[],
  Error,
  { query: string; locale?: string }
>;

export const useSearchFeeds = (options?: UseSearchFeedsOptions) => {
  return useMutation({
    mutationFn: ({ query, locale }) => searchFeeds(query, locale),
    ...options,
  });
};
