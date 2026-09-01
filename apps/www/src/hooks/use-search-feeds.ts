"use client";

import { useDebouncedValue } from "@tanstack/react-pacer";
import { useQuery } from "@tanstack/react-query";

import type { Locale } from "@chia/db/types";

import { orpc } from "@/libs/orpc/client";

const SEARCH_DEBOUNCE_MS = 300;
const MIN_SEARCH_LENGTH = 2;

export function useSearchFeeds(keyword: string, locale: Locale) {
  const [debouncedKeyword] = useDebouncedValue(keyword.trim(), {
    wait: SEARCH_DEBOUNCE_MS,
  });
  const canSearch = debouncedKeyword.length >= MIN_SEARCH_LENGTH;

  const query = useQuery({
    ...orpc.feeds.search.queryOptions({
      input: { keyword: debouncedKeyword, locale },
    }),
    enabled: canSearch,
    staleTime: 60_000,
  });

  return {
    ...query,
    canSearch,
    debouncedKeyword,
  };
}
