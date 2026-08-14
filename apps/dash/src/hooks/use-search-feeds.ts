import { useMutation } from "@tanstack/react-query";

import { orpc } from "@/libs/orpc/client";

/**
 * Feed search as a mutation — it is user-triggered and debounced by the caller, so it is
 * not cached like a query.
 */
export const useSearchFeeds = () =>
  useMutation(orpc.feeds["search:advanced"].mutationOptions());
