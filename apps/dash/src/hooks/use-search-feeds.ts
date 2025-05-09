import { useMutation } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";

import type { Feed } from "@chia/db/schema";

import { searchFeeds } from "@/resources/feed.resource";

type UseSearchFeedsOptions = UseMutationOptions<
  (Feed & { similarity: number })[],
  Error,
  string
>;

export const useSearchFeeds = (options?: UseSearchFeedsOptions) => {
  return useMutation({
    mutationFn: (query) => searchFeeds(query),
    ...options,
  });
};
