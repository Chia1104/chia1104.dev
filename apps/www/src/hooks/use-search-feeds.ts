"use client";

import { useDebouncedValue } from "@tanstack/react-pacer";
import { useQuery } from "@tanstack/react-query";

import { publicFeedSearchResponseSchema } from "@chia/api/services/validators";
import type { Locale } from "@chia/db/types";

import { client } from "@/libs/service/client";

const SEARCH_DEBOUNCE_MS = 300;
const MIN_SEARCH_LENGTH = 2;

export function useSearchFeeds(keyword: string, locale: Locale) {
  const [debouncedKeyword] = useDebouncedValue(keyword.trim(), {
    wait: SEARCH_DEBOUNCE_MS,
  });
  const canSearch = debouncedKeyword.length >= MIN_SEARCH_LENGTH;

  const query = useQuery({
    queryKey: ["public-feeds-search", debouncedKeyword, locale],
    enabled: canSearch,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const response = await client.api.v1.feeds.public.search.$get(
        {
          query: {
            keyword: debouncedKeyword,
            locale,
          },
        },
        {
          init: {
            signal,
          },
        }
      );
      if (!response.ok) {
        throw new Error("Failed to search feeds");
      }
      return publicFeedSearchResponseSchema.parse(await response.json());
    },
  });

  return {
    ...query,
    canSearch,
    debouncedKeyword,
  };
}
