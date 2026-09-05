"use client";

import { useEffect, useRef } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { createQueryInvalidator } from "@chia/utils/query-client";

import { orpc } from "@/libs/orpc/client";

/** React Query owns the live connection; Pacer coalesces draft refreshes. */
export const useDraftWatch = (draftId: number) => {
  const queryClient = useQueryClient();
  const refresh = useRef<ReturnType<typeof createQueryInvalidator> | null>(
    null
  );
  const watch = useQuery(
    orpc.feeds["draft:watch"].liveOptions({
      input: { draftId },
      retry: true,
      retryDelay: (attempt) => Math.min(10_000, 1000 * 2 ** attempt),
      staleTime: Infinity,
      gcTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: false,
      // Identical resync events still represent distinct writes.
      structuralSharing: false,
    })
  );

  useEffect(() => {
    const invalidator = createQueryInvalidator(
      queryClient,
      orpc.feeds["draft:get"].queryOptions({ input: { draftId } }).queryKey
    );
    refresh.current = invalidator;
    return () => {
      invalidator.dispose();
      refresh.current = null;
    };
  }, [draftId, queryClient]);

  useEffect(() => {
    if (watch.data?.type === "resync") refresh.current?.request();
  }, [watch.data]);
};
